import { fmtDateHeader } from "./format.js";

const STACK_MS = 5 * 60 * 1000;
const BLOCK_GAP_MS = 30 * 60 * 1000;

function breaksRun(cur, ref) {
  if (!ref || ref.is_call || cur.is_call) return true;
  if (ref.sender_name !== cur.sender_name) return true;
  const dt = cur.timestamp_ms - ref.timestamp_ms;
  if (dt > STACK_MS) return true;
  if (new Date(cur.timestamp_ms).toDateString() !== new Date(ref.timestamp_ms).toDateString()) return true;
  return false;
}

function resolveReplies(msgs) {
  const byKey = new Map();
  for (const msg of msgs) {
    if (msg.content && msg.sender_name) {
      const key = `${msg.sender_name}\x00${msg.content}`;
      if (!byKey.has(key)) byKey.set(key, msg.id);
    }
  }
  for (const msg of msgs) {
    if (msg.reply_to?.snippet && msg.reply_to?.sender && !msg.reply_to.msgId) {
      const id = byKey.get(`${msg.reply_to.sender}\x00${msg.reply_to.snippet}`);
      if (id) msg.reply_to = { ...msg.reply_to, msgId: id };
    }
  }
}

export function groupMessages(msgs) {
  resolveReplies(msgs);
  const out = [];
  let lastDay = null;
  msgs.forEach((msg, i) => {
    const day = new Date(msg.timestamp_ms).toDateString();
    if (day !== lastDay) {
      out.push({ kind: "date", id: "d-" + day, label: fmtDateHeader(msg.timestamp_ms) });
      lastDay = day;
    }
    const prev = msgs[i - 1];
    const next = msgs[i + 1];
    const firstInRun = breaksRun(msg, prev);
    const lastInRun = breaksRun(next || {}, msg);

    // Show a persistent block-end timestamp when a 30+ min gap follows (same day),
    // or at the very end of the thread. Day-boundary gaps are handled by date separators.
    const endsBlock = !msg.is_call && (
      !next ||
      (
        (next.timestamp_ms - msg.timestamp_ms) > BLOCK_GAP_MS &&
        new Date(next.timestamp_ms).toDateString() === new Date(msg.timestamp_ms).toDateString()
      )
    );

    out.push({ kind: "msg", msg, firstInRun, lastInRun, endsBlock });
  });
  return out;
}
