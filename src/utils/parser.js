import JSZip from "jszip";
import { setZip } from "./mediaStore.js";
import { archiveKey, saveMeta, saveMessages } from "./db.js";

function fixEncoding(str) {
  if (!str || typeof str !== "string") return str;
  try { return decodeURIComponent(escape(str)); }
  catch { return str; }
}

function fixObj(obj) {
  if (typeof obj === "string") return fixEncoding(obj);
  if (Array.isArray(obj)) return obj.map(fixObj);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = fixObj(obj[k]);
    return out;
  }
  return obj;
}

const AVATAR_PALETTE = ["#b8836b","#a64b2a","#5c6b5a","#6b7a99","#3a2a1f","#8c6a4a","#7a6b55","#4a6b7a"];
function colorFor(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
  return AVATAR_PALETTE[(h >>> 0) % AVATAR_PALETTE.length];
}
function initialsFor(name) {
  return name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

// Run tasks with at most `limit` in flight at once
async function pool(tasks, limit) {
  let i = 0;
  async function worker() {
    while (i < tasks.length) { const j = i++; await tasks[j](); }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

export async function parseInstagramZip(file, onProgress) {
  // Counters are closure-local — safe to share across parallel async tasks
  // because JS is single-threaded: ++ is atomic, no await between read and write.
  let msgId = 0;
  let callPairId = 0;

  function buildCallMsgs(raw) {
    const base = {
      sender_name: raw.sender_name,
      content: null,
      is_call: true,
      call_duration: raw.call_duration || 0,
      is_video_call: raw.type === "Video Chat" || raw.type === "video_call",
      call_outcome: raw.missed ? "missed" : raw.call_duration > 0 ? "completed" : "missed",
      call_participants: raw.participants ? raw.participants.map((p) => p.name || p) : null,
    };
    if (base.call_outcome !== "completed" || base.call_duration <= 0) {
      return [{ ...base, id: ++msgId, timestamp_ms: raw.timestamp_ms, call_kind: "missed" }];
    }
    const pairId = ++callPairId;
    const startMs = raw.timestamp_ms;
    return [
      { ...base, id: ++msgId, timestamp_ms: startMs, call_kind: "start", call_pair_id: pairId },
      { ...base, id: ++msgId, timestamp_ms: startMs + base.call_duration * 1000, call_kind: "end", call_pair_id: pairId },
    ];
  }

  function parseMsg(raw) {
    if (raw.type === "Call" || raw.type === "Video Chat" || raw.call_duration != null) {
      return buildCallMsgs(raw);
    }
    const msg = {
      id: ++msgId,
      sender_name: raw.sender_name,
      timestamp_ms: raw.timestamp_ms,
      content: raw.content || null,
      reactions: raw.reactions ? raw.reactions.map((r) => ({ actor: r.actor, reaction: r.reaction })) : undefined,
    };
    if (raw.photos?.length) msg.photos = raw.photos.map((p) => ({ uri: p.uri, width: 1080, height: 1080 }));
    if (raw.videos?.length) msg.videos = raw.videos.map((v) => ({ uri: v.uri, duration_s: v.duration_ms ? v.duration_ms / 1000 : 0, width: 1080, height: 1920 }));
    if (raw.audio_files?.length) msg.audio_files = raw.audio_files.map((a) => ({ uri: a.uri, duration_s: a.duration_ms ? a.duration_ms / 1000 : 30 }));
    if (raw.share) {
      const link = raw.share.link || null;
      const owner = raw.share.original_content_owner || null;
      const shareText = raw.share.share_text || null;
      const caption = (shareText && shareText !== link) ? shareText : null;
      msg.share = { caption, original_content_owner: owner, post_caption: caption, link, kind: "post" };
    }
    if (raw.replied_to_message) msg.reply_to = { sender: raw.replied_to_message.sender_name || null, snippet: raw.replied_to_message.content || "(media)" };
    return [msg];
  }

  onProgress?.("Opening archive…", 2);

  let zip;
  try { zip = await JSZip.loadAsync(file); }
  catch { throw new Error("Could not open ZIP file. Make sure it's a valid Instagram data export."); }
  setZip(zip);

  onProgress?.("Scanning message folders…", 8);

  const threadFolders = {};
  zip.forEach((relativePath) => {
    const m = relativePath.match(/messages\/inbox\/([^/]+)\/(message_\d+\.json)$/i);
    if (m) {
      if (!threadFolders[m[1]]) threadFolders[m[1]] = [];
      threadFolders[m[1]].push(relativePath);
    }
  });

  const folderNames = Object.keys(threadFolders);
  if (!folderNames.length) throw new Error("No message folders found. Make sure the ZIP contains a messages/inbox/ directory.");

  onProgress?.(`Found ${folderNames.length} conversation${folderNames.length === 1 ? "" : "s"}…`, 12);

  let profileName = "You";
  let profileHandle = "you";

  // Try every known path Instagram has used across export versions
  const piCandidates = [
    "personal_information/personal_information.json",
    "account_information/personal_information.json",
    "your_instagram_activity/personal_information/personal_information.json",
    "logged_information/personal_information.json",
    "personal_information.json",
  ];
  for (const path of piCandidates) {
    const piFile = zip.file(path);
    if (!piFile) continue;
    try {
      const raw = fixObj(JSON.parse(await piFile.async("string")));
      const info = raw?.profile_user?.[0]?.string_map_data?.Name?.value
        || raw?.profile_v2?.profile_user?.[0]?.string_map_data?.Name?.value
        || raw?.name || null;
      const handle = raw?.profile_user?.[0]?.string_map_data?.Username?.value
        || raw?.profile_v2?.profile_user?.[0]?.string_map_data?.Username?.value
        || raw?.username || null;
      if (handle && profileHandle === "you") profileHandle = handle;
      if (info) { profileName = info; break; }
    } catch {}
  }

  // Heuristic fallback: the user is the participant present in the most threads.
  // Read up to 50 thread metadata files in parallel — cheap since they're tiny JSONs.
  if (profileName === "You") {
    const counts = new Map();
    await Promise.all(
      folderNames.slice(0, Math.min(50, folderNames.length)).map(async (folder) => {
        const paths = threadFolders[folder];
        if (!paths.length) return;
        try {
          const d = fixObj(JSON.parse(await zip.file(paths[0]).async("string")));
          (d.participants || []).forEach((p) => {
            const n = p.name || p;
            counts.set(n, (counts.get(n) || 0) + 1);
          });
        } catch {}
      })
    );
    let maxCount = 0, inferred = null;
    for (const [name, count] of counts) {
      if (count > maxCount) { maxCount = count; inferred = name; }
    }
    if (inferred && maxCount > 1) profileName = inferred;
  }

  const aKey = archiveKey(file.name, file.size);
  const totalFolders = folderNames.length;
  let done = 0;
  const stubs = new Array(totalFolders).fill(null);

  await pool(
    folderNames.map((folder, fi) => async () => {
      const sortedPaths = threadFolders[folder].sort((a, b) => {
        return (parseInt(a.match(/message_(\d+)\.json/)?.[1] || 0) - parseInt(b.match(/message_(\d+)\.json/)?.[1] || 0));
      });

      // Decompress all JSON files for this thread in parallel
      let jsonDatas;
      try {
        jsonDatas = await Promise.all(
          sortedPaths.map((p) => zip.file(p).async("string").then((s) => fixObj(JSON.parse(s))))
        );
      } catch { return; }

      const threadMeta = jsonDatas[0];
      if (!threadMeta) return;

      let allMessages = [];
      for (const d of jsonDatas) {
        if (d.messages) allMessages = allMessages.concat(d.messages);
      }
      if (!allMessages.length) return;

      const parsed = [];
      for (const raw of allMessages) parsed.push(...parseMsg(raw));
      parsed.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

      const participants = (threadMeta.participants || []).map((p) => {
        const name = p.name || p;
        return name === profileName ? "You" : name;
      });
      if (!participants.includes("You")) participants.unshift("You");
      for (const m of parsed) {
        if (m.sender_name === profileName) m.sender_name = "You";
        if (m.reply_to?.sender === profileName) m.reply_to.sender = "You";
      }
      // Try to resolve reply targets by matching sender+content
      const contentLookup = new Map();
      for (const m of parsed) {
        if (m.content) contentLookup.set(`${m.sender_name}\x00${m.content}`, m.id);
      }
      for (const m of parsed) {
        if (m.reply_to && m.reply_to.snippet && m.reply_to.snippet !== "(media)") {
          const id = contentLookup.get(`${m.reply_to.sender}\x00${m.reply_to.snippet}`);
          if (id) m.reply_to.msgId = id;
        }
      }

      const first = parsed[0];
      const last = parsed[parsed.length - 1];
      stubs[fi] = {
        id: folder,
        title: threadMeta.title === profileName ? folder : (threadMeta.title || folder),
        participants,
        is_group: participants.length > 2,
        avatar_color: colorFor(folder),
        avatar_initials: initialsFor(threadMeta.title || folder),
        first_message_ms: first.timestamp_ms,
        last_message_ms: last.timestamp_ms,
        last_message: last,
        total_messages: parsed.length,
      };

      await saveMessages(aKey, folder, parsed);

      done++;
      onProgress?.(`Parsed ${done} / ${totalFolders} conversations…`, 15 + Math.round((done / totalFolders) * 70));
    }),
    8
  );

  const validStubs = stubs.filter(Boolean);
  if (!validStubs.length) throw new Error("No messages could be parsed from this archive.");
  validStubs.sort((a, b) => b.last_message_ms - a.last_message_ms);

  onProgress?.("Finalising…", 88);

  const profile = {
    displayName: "You",
    handle: profileHandle,
    avatarUri: null,
    avatarColor: "#b8836b",
    initials: profileName.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "Y",
  };

  const photoFile = zip.file(`profile_photos/${profileHandle}/profile_photo.jpg`) || zip.file("profile_pictures/profile_photos.json");
  if (photoFile) {
    try { const blob = await photoFile.async("blob"); profile.avatarUri = URL.createObjectURL(blob); } catch {}
  }

  await saveMeta(aKey, { threads: validStubs, profile, archKey: aKey });

  onProgress?.("Ready.", 100);
  return { threads: validStubs, profile, archKey: aKey };
}
