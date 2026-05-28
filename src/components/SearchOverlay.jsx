import { useState, useEffect, useRef, useMemo } from "react";
import { fmtTime, fmtDateHeader } from "../utils/format.js";
import Avatar from "./Avatar.jsx";

function highlightText(text, query) {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="ms-search-hit">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function snippet(text, query, max = 110) {
  if (!query) return text.slice(0, max);
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return text.slice(0, max);
  const before = Math.max(0, idx - 40);
  const after = Math.min(text.length, idx + q.length + 70);
  return (before > 0 ? "…" : "") + text.slice(before, after) + (after < text.length ? "…" : "");
}

export default function SearchOverlay({ threads, open, onClose, onJump, profile, activeThreadId, activeThreadTitle }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [scope, setScope] = useState("all");
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    const out = [];
    const scopedThreads = scope === "thread"
      ? threads.filter((t) => t.id === activeThreadId)
      : threads;
    scopedThreads.forEach((t) => {
      t.messages.forEach((m) => {
        if (!m.content || m.is_call) return;
        if (m.content.toLowerCase().includes(q)) {
          out.push({ threadId: t.id, threadTitle: t.title, threadColor: t.avatar_color, threadInitials: t.avatar_initials, msg: m });
        }
      });
    });
    out.sort((a, b) => b.msg.timestamp_ms - a.msg.timestamp_ms);
    return out.slice(0, 50);
  }, [query, threads, scope, activeThreadId]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // Tab key toggles scope
  function handleKeyDown(e) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "Tab" && activeThreadId) { e.preventDefault(); setScope((s) => s === "all" ? "thread" : "all"); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) { onJump(r.threadId, r.msg.id); onClose(); }
    }
  }

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "");

  if (!open) return null;

  return (
    <div className="ms-search-overlay" onClick={onClose} role="dialog" aria-label="Search messages">
      <div className="ms-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ms-search-modal-input">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder="Search every message…" aria-label="Search query" />
          <span className="ms-search-modal-esc">esc</span>
        </div>

        {activeThreadId && (
          <div className="ms-search-scope" role="tablist" aria-label="Search scope">
            <button className={`ms-search-scope-btn ${scope === "thread" ? "on" : ""}`} role="tab" aria-selected={scope === "thread"} onClick={() => { setScope("thread"); inputRef.current?.focus(); }}>
              <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4 H13.5 V11 A1 1 0 0 1 12.5 12 H6.2 L3.5 14 V12 A1 1 0 0 1 2.5 11 Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
              <span>In <em>{activeThreadTitle}</em></span>
            </button>
            <button className={`ms-search-scope-btn ${scope === "all" ? "on" : ""}`} role="tab" aria-selected={scope === "all"} onClick={() => { setScope("all"); inputRef.current?.focus(); }}>
              <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6 H10 M2 6 V11 A1 1 0 0 0 3 12 H8.5 L11 13.6 V12 A1 1 0 0 0 12 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 3 H13 A1 1 0 0 1 14 4 V9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
              <span>All conversations</span>
            </button>
            <span className="ms-search-scope-hint"><kbd>tab</kbd> to toggle</span>
          </div>
        )}

        {!query.trim() && (
          <div className="ms-search-empty">
            <p>{scope === "thread" ? <>Search within <em>{activeThreadTitle}</em>.</> : <>Search across every word you've ever written — or had written to you.</>}</p>
            <div className="ms-search-tips">
              <div><kbd>↑</kbd><kbd>↓</kbd><span>navigate</span></div>
              <div><kbd>↵</kbd><span>open</span></div>
              <div><kbd>esc</kbd><span>close</span></div>
            </div>
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div className="ms-search-noresults"><em>"{query}"</em> doesn't appear anywhere in your archive.</div>
        )}

        {results.length > 0 && (
          <>
            <div className="ms-search-resultsmeta">{results.length}{results.length >= 50 ? "+" : ""} result{results.length === 1 ? "" : "s"}</div>
            <div className="ms-search-results" ref={listRef} role="listbox">
              {results.map((r, i) => {
                const mine = r.msg.sender_name === "You";
                const senderName = mine ? (profile?.displayName || "You") : r.msg.sender_name;
                return (
                  <button key={`${r.threadId}-${r.msg.id}`} data-idx={i} className={`ms-search-result ${i === activeIdx ? "ms-search-result-on" : ""}`} role="option" aria-selected={i === activeIdx} onMouseEnter={() => setActiveIdx(i)} onClick={() => { onJump(r.threadId, r.msg.id); onClose(); }}>
                    <Avatar name={r.threadTitle} color={r.threadColor} initials={r.threadInitials} size={26} />
                    <div className="ms-search-result-body">
                      <div className="ms-search-result-top">
                        <span className="ms-search-result-thread">{r.threadTitle}</span>
                        <span className="ms-search-result-sep">·</span>
                        <span className="ms-search-result-sender">{senderName}</span>
                        <span className="ms-search-result-time">{fmtDateHeader(r.msg.timestamp_ms)}, {fmtTime(r.msg.timestamp_ms)}</span>
                      </div>
                      <div className="ms-search-result-snip">{highlightText(snippet(r.msg.content, query), query)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
