import { useState } from "react";
import Avatar from "./Avatar.jsx";
import { fmtRelative, fmtYearRange, fmtCallDuration } from "../utils/format.js";

export default function ThreadList({ threads, activeId, onSelect, onBackToImport, onOpenSearch, onOpenSettings }) {
  const [query, setQuery] = useState("");

  const filtered = threads.filter((t) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.participants.some((p) => p.toLowerCase().includes(q));
  });

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "");
  const modGlyph = isMac ? "⌘" : "Ctrl";

  return (
    <aside className="ms-rail">
      <div className="ms-rail-head">
        <div className="ms-brand" onClick={onBackToImport} title="Back to import" style={{ cursor: "pointer" }}>
          <span className="ms-brand-mark">M</span>
          <span className="ms-brand-word">essories</span>
        </div>
        <div className="ms-rail-head-actions">
          <button className="ms-rail-head-btn" onClick={onOpenSettings} aria-label="Settings" title="Settings">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <line x1="2" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="2" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="5.5" cy="5" r="2" fill="var(--p-bg)" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="10.5" cy="11" r="2" fill="var(--p-bg)" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
          <div className="ms-privacy-chip" title="All data stays on this device.">
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 1.2 C7.7 1.2 9 2.5 9 4.2 V5.4 H9.4 A.6.6 0 0 1 10 6 V10 A.6.6 0 0 1 9.4 10.6 H2.6 A.6.6 0 0 1 2 10 V6 A.6.6 0 0 1 2.6 5.4 H3 V4.2 C3 2.5 4.3 1.2 6 1.2 Z M6 2.4 C5 2.4 4.2 3.2 4.2 4.2 V5.4 H7.8 V4.2 C7.8 3.2 7 2.4 6 2.4 Z" fill="currentColor"/>
            </svg>
            <span>local</span>
          </div>
        </div>
      </div>

      <button className="ms-search ms-search-trigger" onClick={onOpenSearch} aria-label="Search every message" title="Search every message">
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <span className="ms-search-trigger-label">Search every message</span>
        <kbd className="ms-search-kbd">{modGlyph}F</kbd>
      </button>

      <div className="ms-rail-filter">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter threads…" aria-label="Filter threads" />
      </div>

      <div className="ms-rail-list">
        {filtered.map((t) => {
          const isActive = t.id === activeId;
          const last = t.last_message;
          const lastWho = last.sender_name === "You" ? "You: " : t.is_group ? `${last.sender_name.split(" ")[0]}: ` : "";
          let preview = "";
          if (last.is_call) {
            const kind = last.is_video_call ? "Video call" : "Audio call";
            if (last.call_outcome === "missed") preview = `📞 Missed ${kind.toLowerCase()}`;
            else if (last.call_outcome === "declined") preview = `📞 ${kind} declined`;
            else preview = `📞 ${kind} · ${fmtCallDuration(last.call_duration)}`;
          } else if (last.content) preview = last.content;
          else if (last.photos) preview = "📷 Photo";
          else if (last.videos) preview = "🎬 Video";
          else if (last.audio_files) preview = "🎙 Voice message";
          else if (last.share) preview = "📨 Shared post";

          return (
            <button key={t.id} className={`ms-thread-item ${isActive ? "ms-thread-item-on" : ""}`} onClick={() => onSelect(t.id)}>
              <Avatar name={t.title} color={t.avatar_color} initials={t.avatar_initials} size={40} />
              <div className="ms-thread-item-body">
                <div className="ms-thread-item-top">
                  <span className="ms-thread-item-title">{t.title}</span>
                  <span className="ms-thread-item-time">{fmtRelative(t.last_message_ms)}</span>
                </div>
                <div className="ms-thread-item-preview">
                  <span className="ms-thread-item-who">{lastWho}</span>
                  {preview}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="ms-rail-foot">
        <div className="ms-rail-foot-row">
          <span>{threads.length} archived thread{threads.length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{threads.reduce((a, t) => a + t.total_messages, 0).toLocaleString()} messages</span>
        </div>
        <div className="ms-rail-foot-row ms-muted">
          Loaded from instagram-export · {fmtYearRange(
            Math.min(...threads.map((t) => t.first_message_ms)),
            Math.max(...threads.map((t) => t.last_message_ms))
          )}
        </div>
      </div>
    </aside>
  );
}
