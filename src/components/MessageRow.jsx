import { fmtTime, fmtFullDateTime, placeholderSrc } from "../utils/format.js";
import Avatar from "./Avatar.jsx";
import VoiceMessage from "./VoiceMessage.jsx";
import MediaBlock from "./MediaBlock.jsx";
import CallCard from "./CallCard.jsx";

function SharedPost({ share, palette }) {
  const handle = share.original_content_owner || "unknown";
  const href = share.link || `https://instagram.com/p/${encodeURIComponent(handle)}`;
  return (
    <a className="ms-share ms-share-link" href={href} target="_blank" rel="noopener noreferrer" title={`Open on Instagram ↗`} onClick={(e) => e.stopPropagation()}>
      <div className="ms-share-head">
        <div className="ms-share-dot" />
        <span className="ms-share-handle">@{handle}</span>
        <span className="ms-share-kind">shared post</span>
        <span className="ms-share-ext" aria-hidden="true">
          <svg width="11" height="11" viewBox="0 0 12 12"><path d="M5 2 H10 V7 M10 2 L5.5 6.5 M9 6.5 V10 H2 V3 H5.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </div>
      <div className="ms-share-img" style={{ backgroundImage: `url("${placeholderSrc("share:" + handle, 800, 800, palette)}")` }} />
      {share.post_caption && <div className="ms-share-caption">"{share.post_caption}"</div>}
    </a>
  );
}

function ReactionsRow({ reactions, mine }) {
  if (!reactions || !reactions.length) return null;
  const grouped = {};
  reactions.forEach((r) => { grouped[r.reaction] = (grouped[r.reaction] || 0) + 1; });
  return (
    <div className={`ms-reacts ${mine ? "ms-reacts-mine" : ""}`}>
      {Object.entries(grouped).map(([emoji, count]) => (
        <span key={emoji} className="ms-react">
          <span className="ms-react-emoji">{emoji}</span>
          {count > 1 && <span className="ms-react-n">{count}</span>}
        </span>
      ))}
    </div>
  );
}

export default function MessageRow({ msg, firstInRun, lastInRun, endsBlock, palette, density, profile, onJump, onScrollToMsg, onOpenMedia, highlight }) {
  const mine = msg.sender_name === "You";

  if (msg.is_call) {
    return (
      <div className={`ms-row ms-row-call ${highlight ? "ms-row-highlight" : ""}`} data-msg-id={msg.id}>
        <CallCard msg={msg} onJump={onJump} highlight={highlight} />
      </div>
    );
  }

  const hasText = !!msg.content;
  const hasMedia = (msg.photos && msg.photos.length) || (msg.videos && msg.videos.length);
  const hasVoice = msg.audio_files && msg.audio_files.length;
  const hasShare = msg.share;
  const reactions = msg.reactions;

  const runPos = firstInRun && lastInRun ? "single" : firstInRun ? "first" : lastInRun ? "last" : "middle";
  const bubbleCls = (kind) => `ms-bubble ms-bubble-${kind} ms-bubble-${runPos} ${mine ? "ms-bubble-mine" : ""}`;

  const senderColor = msg._avatarColor || (mine ? profile?.avatarColor : "#b8836b");
  const senderInits = msg._avatarInitials || (mine ? profile?.initials : null);
  const senderName = mine ? (profile?.displayName || "You") : msg.sender_name;
  const senderSrc = mine ? profile?.avatarUri : null;

  const ts = fmtTime(msg.timestamp_ms);

  return (
    <>
      <div
        className={`ms-row ms-row-${mine ? "mine" : "theirs"} ms-row-${firstInRun ? "start" : "stack"} ${highlight ? "ms-row-highlight" : ""}`}
        data-msg-id={msg.id}
      >
        <div className="ms-row-gutter">
          {firstInRun && (
            <Avatar name={senderName} color={senderColor} initials={senderInits} src={senderSrc} size={28} />
          )}
        </div>
        <div className="ms-row-body">
          {firstInRun && <div className="ms-row-name">{senderName}</div>}
          {msg.reply_to && (
            <div
              className={`ms-reply ${mine ? "ms-reply-mine" : ""} ${msg.reply_to.msgId ? "ms-reply-clickable" : ""}`}
              onClick={msg.reply_to.msgId ? () => onScrollToMsg?.(msg.reply_to.msgId) : undefined}
              role={msg.reply_to.msgId ? "button" : undefined}
              tabIndex={msg.reply_to.msgId ? 0 : undefined}
              onKeyDown={msg.reply_to.msgId ? (e) => { if (e.key === "Enter" || e.key === " ") onScrollToMsg?.(msg.reply_to.msgId); } : undefined}
            >
              <span className="ms-reply-bar" />
              <div className="ms-reply-body">
                {msg.reply_to.sender && <span className="ms-reply-sender">{msg.reply_to.sender}</span>}
                <span className="ms-reply-text">{msg.reply_to.snippet}</span>
              </div>
            </div>
          )}
          {hasShare && (
            <div className={`ms-bubble-wrap ${mine ? "ms-mine" : ""}`} data-time={ts}>
              <div className={bubbleCls("media")}>
                <SharedPost share={msg.share} palette={palette} />
                {msg.share.caption && <div className="ms-share-cap-line">{msg.share.caption}</div>}
              </div>
              <ReactionsRow reactions={reactions} mine={mine} />
            </div>
          )}
          {hasMedia && (
            <div className={`ms-bubble-wrap ${mine ? "ms-mine" : ""}`} data-time={ts}>
              <div className={bubbleCls("media")}>
                <MediaBlock
                  photos={msg.photos}
                  videos={msg.videos}
                  palette={palette}
                  onOpenItem={(localIdx) => onOpenMedia?.(msg.id, localIdx)}
                />
              </div>
              <ReactionsRow reactions={reactions} mine={mine} />
            </div>
          )}
          {hasVoice && (
            <div className={`ms-bubble-wrap ${mine ? "ms-mine" : ""}`} data-time={ts}>
              <div className={bubbleCls("voice")}>
                <VoiceMessage audio={msg.audio_files[0]} mine={mine} />
              </div>
              <ReactionsRow reactions={reactions} mine={mine} />
            </div>
          )}
          {hasText && (
            <div className={`ms-bubble-wrap ${mine ? "ms-mine" : ""}`} data-time={ts}>
              <div className={bubbleCls("text")}>{msg.content}</div>
              <ReactionsRow reactions={reactions} mine={mine} />
            </div>
          )}
        </div>
      </div>
      {endsBlock && (
        <div className="ms-stack-time" title={fmtFullDateTime(msg.timestamp_ms)}>
          {ts}
        </div>
      )}
    </>
  );
}
