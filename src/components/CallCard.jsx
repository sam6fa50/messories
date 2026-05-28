import { fmtTime } from "../utils/format.js";

export default function CallCard({ msg, onJump, highlight }) {
  const dur = msg.call_duration || 0;
  const outcome = msg.call_outcome;
  const isVideo = msg.is_video_call;
  const wasMissedOrDeclined = outcome === "missed" || outcome === "declined" || outcome === "no_answer";
  const mine = msg.sender_name === "You";
  const isStart = msg.call_kind === "start";
  const isEnd = msg.call_kind === "end";

  let label;
  if (wasMissedOrDeclined) {
    label = outcome === "missed" ? (mine ? "No answer" : "Missed") : "Declined";
  } else if (isStart) {
    label = mine ? "Started by you" : `${msg.sender_name.split(" ")[0]} called`;
  } else if (isEnd) {
    label = "Ended";
  } else {
    label = mine ? "Outgoing" : "Incoming";
  }

  let durText = null;
  if (dur > 0) {
    const h = Math.floor(dur / 3600);
    const mm = Math.floor((dur % 3600) / 60);
    const ss = Math.floor(dur % 60).toString().padStart(2, "0");
    if (h > 0) durText = `${h}h ${mm}m`;
    else if (mm > 0) durText = `${mm}m ${ss}s`;
    else durText = `${ss}s`;
  }

  const kindWord = isVideo ? "Video call" : "Audio call";
  const kindSuffix = isStart ? " started" : isEnd ? " ended" : "";

  const icon = isVideo ? (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <rect x="1.4" y="4" width="9" height="8" rx="1.6" fill="currentColor"/>
      <path d="M11 8 L14.6 5.4 V10.6 L11 8 Z" fill="currentColor"/>
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M3.4 2.4 C3.4 2.4 4 2 5 2 C5.9 2 6.6 2.5 6.8 3.6 L7.2 5.4 C7.4 6.2 7.2 6.7 6.5 7.2 L5.7 7.7 C6.4 9 7 9.6 8.3 10.3 L8.8 9.5 C9.3 8.8 9.8 8.6 10.6 8.8 L12.4 9.2 C13.5 9.4 14 10.1 14 11 C14 12 13.6 12.6 13.6 12.6 C12.8 13.4 11.8 13.6 10.8 13.4 C7 12.8 3.2 9 2.6 5.2 C2.4 4.2 2.6 3.2 3.4 2.4 Z" fill="currentColor"/>
    </svg>
  );

  const pairIcon = isStart ? (
    <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
      <path d="M5 1 V8 M2 5.5 L5 8.5 L8 5.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : isEnd ? (
    <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
      <path d="M5 9 V2 M2 4.5 L5 1.5 L8 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : wasMissedOrDeclined ? (
    <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
      <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ) : null;

  const isPair = isStart || isEnd;
  const handleClick = () => {
    if (isPair && msg.call_pair_id != null && onJump)
      onJump(msg.call_pair_id, isStart ? "end" : "start");
  };

  return (
    <div
      className={[
        "ms-call",
        wasMissedOrDeclined ? "ms-call-missed" : "",
        isVideo ? "ms-call-video" : "ms-call-audio",
        isStart ? "ms-call-start" : "",
        isEnd ? "ms-call-end" : "",
        isPair ? "ms-call-pair" : "",
        highlight ? "ms-call-highlight" : "",
      ].join(" ")}
      data-call-pair={msg.call_pair_id}
      data-call-kind={msg.call_kind}
      data-msg-id={msg.id}
      onClick={handleClick}
      role={isPair ? "button" : "article"}
      tabIndex={isPair ? 0 : undefined}
      onKeyDown={(e) => { if (isPair && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleClick(); } }}
      aria-label={`${kindWord}${kindSuffix} · ${label}${durText ? ` · ${durText}` : ""}${isPair ? " — click to jump to other end" : ""}`}
    >
      <span className="ms-call-icon" aria-hidden="true">{icon}</span>
      <span className="ms-call-body">
        <span className="ms-call-kind">
          {kindWord}<span className="ms-call-kind-suffix">{kindSuffix}</span>
        </span>
        <span className="ms-call-meta">
          {pairIcon && <span className="ms-call-arrow">{pairIcon}</span>}
          <span className="ms-call-label">{label}</span>
          {durText && <span className="ms-call-dur">· {durText}</span>}
          {msg.call_participants && msg.call_participants.length > 2 && (
            <span className="ms-call-group">· {msg.call_participants.length}p</span>
          )}
        </span>
      </span>
      <span className="ms-call-time">{fmtTime(msg.timestamp_ms)}</span>
    </div>
  );
}
