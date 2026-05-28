import { fmtTime, fmtCallDuration, fmtDateHeader } from "./format.js";
import { resolveUri } from "./mediaStore.js";

function dlBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeName(str) {
  return str.replace(/[^a-z0-9\-_]/gi, "_").slice(0, 60);
}

function he(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Markdown ──────────────────────────────────────────────────────────────────

export function exportMarkdown(thread) {
  const lines = [
    `# ${thread.title}`,
    ``,
    `*${thread.total_messages.toLocaleString()} messages · ` +
      `${new Date(thread.first_message_ms).getFullYear()}–` +
      `${new Date(thread.last_message_ms).getFullYear()}*`,
    ``,
  ];

  let lastDate = null;
  thread.messages.forEach((m) => {
    const date = new Date(m.timestamp_ms).toDateString();
    if (date !== lastDate) {
      lines.push(``, `---`, ``, `### ${fmtDateHeader(m.timestamp_ms)}`, ``);
      lastDate = date;
    }

    if (m.is_call) {
      if (m.call_kind === "end") return;
      const kind = m.is_video_call ? "Video call" : "Audio call";
      const outcome =
        m.call_outcome === "missed" || m.call_outcome === "declined"
          ? m.call_outcome
          : fmtCallDuration(m.call_duration);
      lines.push(`*📞 ${kind} · ${outcome} · ${fmtTime(m.timestamp_ms)}*`, ``);
      return;
    }

    lines.push(`**${m.sender_name}** · *${fmtTime(m.timestamp_ms)}*`);
    if (m.reply_to) {
      const who = m.reply_to.sender ? `**${m.reply_to.sender}:** ` : "";
      lines.push(`> ↩ ${who}${m.reply_to.snippet}`);
    }
    if (m.content) lines.push(m.content);
    if (m.photos?.length) lines.push(`📷 *${m.photos.length} photo${m.photos.length > 1 ? "s" : ""}*`);
    if (m.videos?.length) lines.push(`🎬 *${m.videos.length} video${m.videos.length > 1 ? "s" : ""}*`);
    if (m.audio_files?.length) lines.push(`🎙 *Voice message*`);
    if (m.share) lines.push(`📨 *Shared post — @${m.share.original_content_owner}*`);
    if (m.reactions?.length) {
      const grouped = {};
      m.reactions.forEach((r) => { grouped[r.reaction] = (grouped[r.reaction] || 0) + 1; });
      lines.push(
        Object.entries(grouped)
          .map(([e, n]) => (n > 1 ? `${e}×${n}` : e))
          .join("  ")
      );
    }
    lines.push(``);
  });

  dlBlob(
    new Blob([lines.join("\n")], { type: "text/markdown" }),
    `${safeName(thread.title)}_messages.md`
  );
}

// ── Photos zip ────────────────────────────────────────────────────────────────

export async function exportPhotosZip(thread, onProgress) {
  const items = [];
  thread.messages.forEach((m) => {
    const date = new Date(m.timestamp_ms).toISOString().slice(0, 10);
    (m.photos || []).forEach((p) => {
      if (p.uri) items.push({ uri: p.uri, name: `${date}_photo_${String(items.length + 1).padStart(4, "0")}.jpg` });
    });
    (m.videos || []).forEach((v) => {
      if (v.uri) items.push({ uri: v.uri, name: `${date}_video_${String(items.length + 1).padStart(4, "0")}.mp4` });
    });
  });

  if (!items.length) return "none";

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  let done = 0;
  let found = 0;

  await Promise.all(
    items.map(async ({ uri, name }) => {
      const resolved = await resolveUri(uri);
      if (!resolved) { onProgress?.(++done, items.length); return; }
      const blob = await fetch(resolved).then((r) => r.blob());
      zip.file(name, blob);
      found++;
      onProgress?.(++done, items.length);
    })
  );

  if (!found) return "none";

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  dlBlob(zipBlob, `${safeName(thread.title)}_photos.zip`);
  return "done";
}

// ── Print / PDF ───────────────────────────────────────────────────────────────

export function exportPrint(thread) {
  let lastDate = null;
  const rows = [];

  thread.messages.forEach((m) => {
    const date = new Date(m.timestamp_ms).toDateString();
    if (date !== lastDate) {
      rows.push(`<div class="ds">${fmtDateHeader(m.timestamp_ms)}</div>`);
      lastDate = date;
    }

    if (m.is_call) {
      if (m.call_kind === "end") return;
      const kind = m.is_video_call ? "Video call" : "Audio call";
      const outcome =
        m.call_outcome === "missed" || m.call_outcome === "declined"
          ? m.call_outcome
          : fmtCallDuration(m.call_duration);
      rows.push(`<div class="call">📞 ${kind} · ${outcome}</div>`);
      return;
    }

    const mine = m.sender_name === "You";
    let h = `<div class="msg${mine ? " mine" : ""}">`;
    h += `<div class="who">${he(m.sender_name)}<span class="ts">${fmtTime(m.timestamp_ms)}</span></div>`;
    if (m.reply_to) {
      const who = m.reply_to.sender ? `<b>${he(m.reply_to.sender)}:</b> ` : "";
      h += `<blockquote>${who}${he(m.reply_to.snippet)}</blockquote>`;
    }
    if (m.content) h += `<p>${he(m.content)}</p>`;
    if (m.photos?.length) h += `<span class="att">📷 ${m.photos.length} photo${m.photos.length > 1 ? "s" : ""}</span>`;
    if (m.videos?.length) h += `<span class="att">🎬 ${m.videos.length} video${m.videos.length > 1 ? "s" : ""}</span>`;
    if (m.audio_files?.length) h += `<span class="att">🎙 Voice message</span>`;
    if (m.share) h += `<span class="att">📨 @${he(m.share.original_content_owner)}</span>`;
    if (m.reactions?.length) {
      const gr = {};
      m.reactions.forEach((r) => { gr[r.reaction] = (gr[r.reaction] || 0) + 1; });
      h += `<div class="rx">${Object.entries(gr).map(([e, n]) => (n > 1 ? `${e}${n}` : e)).join(" ")}</div>`;
    }
    h += `</div>`;
    rows.push(h);
  });

  const win = window.open("", "_blank");
  if (!win) { alert("Allow pop-ups for this site to export as PDF."); return; }

  win.document.write(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>${he(thread.title)} — Messories</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,serif;font-size:11pt;line-height:1.55;color:#1a1612;background:#faf8f4;padding:32px 24px;max-width:640px;margin:0 auto}
h1{font-size:20pt;font-weight:400;letter-spacing:-.02em;margin-bottom:3px}
.meta{font-family:monospace;font-size:9pt;color:#9a8878;margin-bottom:28px}
.ds{font-family:monospace;font-size:8.5pt;color:#b0a090;letter-spacing:.08em;text-transform:uppercase;text-align:center;margin:20px 0 10px;border-top:.5pt solid #e0d4c0;padding-top:10px}
.call{font-family:monospace;font-size:9pt;color:#b0a090;text-align:center;margin:6px 0}
.msg{margin:0 0 9px}
.who{font-family:monospace;font-size:8.5pt;color:#b0a090;margin-bottom:2px}
.ts{color:#c8b8a8;margin-left:8px}
p{white-space:pre-wrap;word-break:break-word}
blockquote{border-left:2pt solid #c9a86b;padding:2px 8px;font-size:10pt;color:#9a8878;font-style:italic;margin:2px 0 4px}
.att{font-size:10pt;color:#b0a090;font-style:italic;display:block}
.rx{font-size:12pt;margin-top:2px}
.mine .who,.mine p,.mine .rx{text-align:right}
@page{margin:2cm}
@media print{body{background:#fff;padding:0}}
</style></head>
<body>
<h1>${he(thread.title)}</h1>
<div class="meta">${thread.total_messages.toLocaleString()} messages · ${new Date(thread.first_message_ms).getFullYear()}–${new Date(thread.last_message_ms).getFullYear()}</div>
${rows.join("\n")}
<script>window.addEventListener("load",()=>window.print())<\/script>
</body></html>`);
  win.document.close();
}
