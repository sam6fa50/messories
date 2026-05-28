import { fmtYearRange } from "./format.js";

export function threadStats(thread, since = 0) {
  const msgs = since
    ? thread.messages.filter((m) => m.timestamp_ms >= since)
    : thread.messages;

  const senders = {};
  const emojiCount = {};
  const hist = new Array(24).fill(0);
  let voice = 0, imgs = 0, vids = 0;
  let callsTotal = 0, callsVideo = 0, callsAudio = 0;
  let callsMissed = 0, callsCompleted = 0;
  let secondsOnCall = 0, longestCall = 0, longestCallVideo = false;
  let minTs = Infinity, maxTs = -Infinity;

  for (const m of msgs) {
    if (m.timestamp_ms < minTs) minTs = m.timestamp_ms;
    if (m.timestamp_ms > maxTs) maxTs = m.timestamp_ms;

    if (m.is_call) {
      if (m.call_kind === "end") continue;
      callsTotal++;
      if (m.is_video_call) callsVideo++; else callsAudio++;
      if (m.call_outcome === "missed" || m.call_outcome === "declined" || m.call_outcome === "no_answer") {
        callsMissed++;
      } else {
        callsCompleted++;
        secondsOnCall += m.call_duration || 0;
        if ((m.call_duration || 0) > longestCall) {
          longestCall = m.call_duration;
          longestCallVideo = m.is_video_call;
        }
      }
      continue;
    }

    senders[m.sender_name] = (senders[m.sender_name] || 0) + 1;
    if (m.audio_files) voice += m.audio_files.length;
    if (m.photos)      imgs  += m.photos.length;
    if (m.videos)      vids  += m.videos.length;
    hist[new Date(m.timestamp_ms).getHours()]++;
    if (m.reactions) for (const r of m.reactions) {
      emojiCount[r.reaction] = (emojiCount[r.reaction] || 0) + 1;
    }
  }

  const topEmoji = Object.entries(emojiCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const safeMin = isFinite(minTs) ? minTs : thread.first_message_ms;
  const safeMax = isFinite(maxTs) ? maxTs : thread.last_message_ms;

  return {
    total: thread.total_messages,
    windowed: msgs.length,
    senders,
    topEmoji,
    voice, imgs, vids,
    hist,
    yearRange: fmtYearRange(safeMin, safeMax),
    calls: {
      total: callsTotal, video: callsVideo, audio: callsAudio,
      missed: callsMissed, completed: callsCompleted,
      secondsOnCall, longestCall, longestCallVideo,
    },
  };
}
