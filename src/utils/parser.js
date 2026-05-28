import JSZip from "jszip";

// Instagram exports all text as mojibake: UTF-8 bytes stored as Latin-1 chars.
// This is a known quirk of Meta's data export format.
function fixEncoding(str) {
  if (!str || typeof str !== "string") return str;
  try {
    // escape() converts each char to %XX using the char code (Latin-1),
    // then decodeURIComponent interprets those as UTF-8 bytes.
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
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

// Build a stable avatar color from a string
const AVATAR_PALETTE = [
  "#b8836b", "#a64b2a", "#5c6b5a", "#6b7a99",
  "#3a2a1f", "#8c6a4a", "#7a6b55", "#4a6b7a",
];
function colorFor(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return AVATAR_PALETTE[(h >>> 0) % AVATAR_PALETTE.length];
}

function initialsFor(name) {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

let _msgId = 0;
let _callPairId = 0;

function buildCallMessages(raw, mediaBlobs) {
  const base = {
    sender_name: raw.sender_name,
    content: null,
    is_call: true,
    call_duration: raw.call_duration || 0,
    is_video_call: raw.type === "Video Chat" || raw.type === "video_call",
    call_outcome: raw.missed ? "missed" : raw.call_duration > 0 ? "completed" : "missed",
    call_participants: raw.participants
      ? raw.participants.map((p) => p.name || p)
      : null,
  };

  if (base.call_outcome !== "completed" || base.call_duration <= 0) {
    return [
      {
        ...base,
        id: ++_msgId,
        timestamp_ms: raw.timestamp_ms,
        call_kind: "missed",
      },
    ];
  }

  const pairId = ++_callPairId;
  const startMs = raw.timestamp_ms;
  const endMs = startMs + base.call_duration * 1000;
  return [
    { ...base, id: ++_msgId, timestamp_ms: startMs, call_kind: "start", call_pair_id: pairId },
    { ...base, id: ++_msgId, timestamp_ms: endMs, call_kind: "end", call_pair_id: pairId },
  ];
}

function parseRawMessage(raw, mediaBlobs) {
  // Handle call events
  if (raw.type === "Call" || raw.type === "Video Chat" || raw.call_duration != null) {
    return buildCallMessages(raw, mediaBlobs);
  }

  const msg = {
    id: ++_msgId,
    sender_name: raw.sender_name,
    timestamp_ms: raw.timestamp_ms,
    content: raw.content || null,
    reactions: raw.reactions
      ? raw.reactions.map((r) => ({ actor: r.actor, reaction: r.reaction }))
      : undefined,
  };

  // Photos
  if (raw.photos && raw.photos.length) {
    msg.photos = raw.photos.map((p) => ({
      uri: mediaBlobs[p.uri] || p.uri,
      width: 1080,
      height: 1080,
      _originalUri: p.uri,
    }));
  }

  // Videos
  if (raw.videos && raw.videos.length) {
    msg.videos = raw.videos.map((v) => ({
      uri: mediaBlobs[v.uri] || v.uri,
      duration_s: v.duration_ms ? v.duration_ms / 1000 : 0,
      width: 1080,
      height: 1920,
      _originalUri: v.uri,
    }));
  }

  // Audio
  if (raw.audio_files && raw.audio_files.length) {
    msg.audio_files = raw.audio_files.map((a) => ({
      uri: mediaBlobs[a.uri] || a.uri,
      duration_s: a.duration_ms ? a.duration_ms / 1000 : 30,
      _originalUri: a.uri,
    }));
  }

  // Shared posts / links
  if (raw.share) {
    msg.share = {
      caption: raw.share.share_text || null,
      original_content_owner: raw.share.original_content_owner || raw.share.link || "unknown",
      post_caption: raw.share.share_text || null,
      link: raw.share.link || null,
      kind: "post",
    };
  }

  // Reply context — Instagram exports use "replied_to_message"
  if (raw.replied_to_message) {
    msg.reply_to = {
      sender: raw.replied_to_message.sender_name || null,
      snippet: raw.replied_to_message.content || "(media)",
    };
  }

  return [msg];
}

async function loadMediaBlobs(zip, paths) {
  const blobs = {};
  await Promise.all(
    paths.map(async (path) => {
      // Normalize path separators
      const normalized = path.replace(/\\/g, "/");
      let file = zip.file(normalized);
      // Try with and without leading slash
      if (!file) file = zip.file(normalized.replace(/^\//, ""));
      if (!file) return;
      try {
        const blob = await file.async("blob");
        blobs[path] = URL.createObjectURL(blob);
      } catch {
        // media file not loadable — leave as original path
      }
    })
  );
  return blobs;
}

export async function parseInstagramZip(file, onProgress) {
  _msgId = 0;
  _callPairId = 0;

  onProgress?.("Opening archive…", 2);

  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("Could not open ZIP file. Make sure it's a valid Instagram data export.");
  }

  onProgress?.("Scanning message folders…", 8);

  // Find all message_N.json files grouped by thread folder
  const threadFolders = {};
  zip.forEach((relativePath) => {
    // Match: <anything>/messages/inbox/<thread>/message_N.json
    const m = relativePath.match(/messages\/inbox\/([^/]+)\/(message_\d+\.json)$/i);
    if (m) {
      const folder = m[1];
      if (!threadFolders[folder]) threadFolders[folder] = [];
      threadFolders[folder].push(relativePath);
    }
  });

  const folderNames = Object.keys(threadFolders);
  if (folderNames.length === 0) {
    throw new Error(
      "No message folders found. Make sure the ZIP contains a messages/inbox/ directory."
    );
  }

  onProgress?.(`Found ${folderNames.length} conversation${folderNames.length === 1 ? "" : "s"}…`, 15);

  // Try to read profile info
  let profileName = "You";
  let profileHandle = "you";
  const piFile =
    zip.file("personal_information/personal_information.json") ||
    zip.file("account_information/personal_information.json");
  if (piFile) {
    try {
      const raw = fixObj(JSON.parse(await piFile.async("string")));
      const info =
        raw?.profile_user?.[0]?.string_map_data?.Name?.value ||
        raw?.profile_v2?.profile_user?.[0]?.string_map_data?.Name?.value ||
        raw?.name ||
        null;
      const handle =
        raw?.profile_user?.[0]?.string_map_data?.Username?.value ||
        raw?.profile_v2?.profile_user?.[0]?.string_map_data?.Username?.value ||
        null;
      if (info) profileName = info;
      if (handle) profileHandle = handle;
    } catch {}
  }

  onProgress?.("Reading conversations…", 20);

  const threads = [];
  const totalFolders = folderNames.length;

  for (let fi = 0; fi < totalFolders; fi++) {
    const folder = folderNames[fi];
    const jsonPaths = threadFolders[folder].sort((a, b) => {
      const na = parseInt(a.match(/message_(\d+)\.json/)?.[1] || "0");
      const nb = parseInt(b.match(/message_(\d+)\.json/)?.[1] || "0");
      return na - nb;
    });

    const pct = 20 + Math.round(((fi + 1) / totalFolders) * 50);
    onProgress?.(`Parsing ${folder}…`, pct);

    let allMessages = [];
    let threadMeta = null;

    for (const jsonPath of jsonPaths) {
      try {
        const raw = fixObj(JSON.parse(await zip.file(jsonPath).async("string")));
        if (!threadMeta) {
          threadMeta = {
            title: raw.title || folder,
            participants: (raw.participants || []).map((p) => p.name || p),
            is_group: (raw.thread_type || "").toLowerCase().includes("group") ||
              (raw.participants && raw.participants.length > 2),
          };
        }
        if (raw.messages) allMessages = allMessages.concat(raw.messages);
      } catch {}
    }

    if (!allMessages.length) continue;

    // Collect all media URIs referenced in messages
    const mediaPaths = new Set();
    allMessages.forEach((m) => {
      (m.photos || []).forEach((p) => mediaPaths.add(p.uri));
      (m.videos || []).forEach((v) => mediaPaths.add(v.uri));
      (m.audio_files || []).forEach((a) => mediaPaths.add(a.uri));
    });

    const mediaBlobs = await loadMediaBlobs(zip, [...mediaPaths]);

    // Parse messages
    const parsed = [];
    for (const raw of allMessages) {
      const msgs = parseRawMessage(raw, mediaBlobs);
      parsed.push(...msgs);
    }

    parsed.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    // Determine participant list — ensure "You" is in there using the profile name
    const participants = threadMeta.participants.map((p) =>
      p === profileName ? "You" : p
    );
    if (!participants.includes("You")) participants.unshift("You");

    // Fix sender names in messages
    parsed.forEach((msg) => {
      if (msg.sender_name === profileName) msg.sender_name = "You";
    });

    const last = parsed[parsed.length - 1];
    const first = parsed[0];

    threads.push({
      id: folder,
      title: threadMeta.title === profileName ? folder : threadMeta.title,
      participants,
      is_group: participants.length > 2,
      avatar_color: colorFor(folder),
      avatar_initials: initialsFor(threadMeta.title || folder),
      first_message_ms: first?.timestamp_ms || Date.now(),
      last_message_ms: last?.timestamp_ms || Date.now(),
      last_message: last,
      total_messages: parsed.length,
      messages: parsed,
    });
  }

  if (!threads.length) {
    throw new Error("No messages could be parsed from this archive.");
  }

  threads.sort((a, b) => b.last_message_ms - a.last_message_ms);

  onProgress?.("Building search index…", 85);

  const profile = {
    displayName: "You",
    handle: profileHandle,
    avatarUri: null,
    avatarColor: "#b8836b",
    initials: profileName
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "Y",
  };

  // Try to load profile photo
  const photoFile =
    zip.file(`profile_photos/${profileHandle}/profile_photo.jpg`) ||
    zip.file("profile_pictures/profile_photos.json");
  if (photoFile) {
    try {
      const blob = await photoFile.async("blob");
      profile.avatarUri = URL.createObjectURL(blob);
    } catch {}
  }

  onProgress?.("Ready.", 100);

  return { threads, profile };
}
