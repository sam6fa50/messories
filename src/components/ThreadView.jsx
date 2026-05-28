import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Avatar from "./Avatar.jsx";
import MessageRow from "./MessageRow.jsx";
import MediaViewer from "./MediaViewer.jsx";
import { groupMessages } from "../utils/groupMessages.js";
import { fmtYearRange } from "../utils/format.js";

const SENDER_PALETTE = ["#b8836b", "#a64b2a", "#5c6b5a", "#6b7a99", "#3a2a1f", "#8c6a4a"];

function estimateSize(item) {
  if (item.kind === "date") return 50;
  const m = item.msg;
  if (m.is_call) return 66;
  let h = item.firstInRun ? 50 : 34;
  if (m.photos || m.videos) {
    const n = (m.photos?.length || 0) + (m.videos?.length || 0);
    h += n === 1 ? 300 : n === 2 ? 188 : 372;
  }
  if (m.audio_files) h += 64;
  if (m.share) h += 72;
  if (m.reactions?.length) h += 30;
  if (m.reply_to) h += 44;
  return h;
}

export default function ThreadView({ thread, palette, density, onToggleInsights, insightsOpen, onBack, narrow, profile, pendingJump, onJumpHandled, onOpenSearch, messagesLoading }) {
  const scrollRef = useRef(null);
  const [highlightId, setHighlightId] = useState(null);
  const [viewerIdx, setViewerIdx] = useState(-1);

  const mediaList = useMemo(() => {
    const out = [];
    thread.messages.forEach((m) => {
      if (!m.photos && !m.videos) return;
      const senderName = m.sender_name === "You" ? (profile?.displayName || "You") : m.sender_name;
      (m.photos || []).forEach((p) => out.push({ ...p, isVideo: false, msgId: m.id, ts: m.timestamp_ms, senderName, caption: m.content || null }));
      (m.videos || []).forEach((v) => out.push({ ...v, isVideo: true,  ts: m.timestamp_ms, senderName, caption: m.content || null }));
    });
    return out;
  }, [thread.id, thread.messages, profile]);

  const mediaStartByMsg = useMemo(() => {
    const map = {};
    mediaList.forEach((m, i) => { if (map[m.msgId] == null) map[m.msgId] = i; });
    return map;
  }, [mediaList]);

  const handleOpenMedia = useCallback((msgId, localIdx) => {
    const start = mediaStartByMsg[msgId];
    if (start == null) return;
    setViewerIdx(start + (localIdx || 0));
  }, [mediaStartByMsg]);

  useEffect(() => { setViewerIdx(-1); }, [thread.id]);

  useEffect(() => {
    setHighlightId(null);
  }, [thread.id]);

  const senderColors = useMemo(() => {
    const map = {};
    let i = 0;
    thread.participants.forEach((p) => {
      if (p === "You") return;
      map[p] = SENDER_PALETTE[i++ % SENDER_PALETTE.length];
    });
    return map;
  }, [thread.id]);

  const decorated = useMemo(() => thread.messages.map((m) => ({
    ...m,
    _avatarColor: m.sender_name === "You" ? profile?.avatarColor : senderColors[m.sender_name],
    _avatarInitials: m.sender_name === "You"
      ? (profile?.initials || "Y")
      : m.sender_name.split(" ").map((s) => s[0]).slice(0, 2).join(""),
  })), [thread.id, thread.messages, senderColors, profile]);

  const grouped = useMemo(() => groupMessages(decorated), [decorated]);

  const virtualizer = useVirtualizer({
    count: grouped.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => estimateSize(grouped[i]),
    overscan: 20,
    paddingEnd: 80,
  });

  // Scroll to bottom on thread change (not when loading)
  useEffect(() => {
    if (messagesLoading || !grouped.length) return;
    virtualizer.scrollToIndex(grouped.length - 1, { align: "end", behavior: "auto" });
  }, [thread.id, messagesLoading, grouped.length]);

  const scrollToMsg = useCallback((msgId) => {
    const idx = grouped.findIndex((item) => item.kind === "msg" && item.msg.id === msgId);
    if (idx < 0) return false;
    virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
    setHighlightId(msgId);
    setTimeout(() => setHighlightId((cur) => (cur === msgId ? null : cur)), 2000);
    return true;
  }, [grouped, virtualizer]);

  const handleCallJump = useCallback((pairId, kind) => {
    const idx = grouped.findIndex((item) =>
      item.kind === "msg" && item.msg.call_pair_id === pairId && item.msg.call_kind === kind
    );
    if (idx >= 0) {
      const msgId = grouped[idx].msg.id;
      virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
      setHighlightId(msgId);
      setTimeout(() => setHighlightId((cur) => (cur === msgId ? null : cur)), 2000);
    }
  }, [grouped, virtualizer]);

  useEffect(() => {
    if (!pendingJump || pendingJump.threadId !== thread.id) return;
    const id = setTimeout(() => { scrollToMsg(pendingJump.msgId); onJumpHandled?.(); }, 80);
    return () => clearTimeout(id);
  }, [pendingJump, thread.id, scrollToMsg, onJumpHandled]);

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "");
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <section className="ms-thread">
      <header className="ms-thread-head">
        {narrow && (
          <button className="ms-back" onClick={onBack} aria-label="Back to threads">
            <svg viewBox="0 0 16 16" width="14" height="14"><path d="M10 2 L4 8 L10 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
        <Avatar name={thread.title} color={thread.avatar_color} initials={thread.avatar_initials} size={36} />
        <div className="ms-thread-head-text">
          <h2>{thread.title}</h2>
          <p>
            {thread.is_group ? `${thread.participants.length} people · ` : ""}
            {thread.total_messages.toLocaleString()} messages ·{" "}
            {fmtYearRange(thread.first_message_ms, thread.last_message_ms)}
          </p>
        </div>
        <button className="ms-head-icon" onClick={onOpenSearch} aria-label="Search every message" title={`Search (${isMac ? "⌘" : "Ctrl"}F)`}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
        <button className={`ms-insights-toggle ${insightsOpen ? "on" : ""}`} onClick={onToggleInsights} aria-label="Toggle insights" title="Insights & media">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <rect x="2" y="9" width="2.2" height="5" fill="currentColor"/>
            <rect x="5.4" y="6" width="2.2" height="8" fill="currentColor"/>
            <rect x="8.8" y="3" width="2.2" height="11" fill="currentColor"/>
            <rect x="12.2" y="7" width="2.2" height="7" fill="currentColor"/>
          </svg>
        </button>
      </header>

      <div className="ms-thread-scroll" ref={scrollRef}>
        {messagesLoading ? (
          <div className="ms-thread-loading">
            <span className="ms-parse-spin" aria-hidden="true" />
            <span>Loading messages…</span>
          </div>
        ) : (
          <>
            <div className="ms-thread-archive-mark ms-msglist">
              archived · read-only · loaded {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
            <div style={{ height: totalSize, position: "relative" }}>
            {virtualItems.map((vRow) => {
              const item = grouped[vRow.index];
              return (
                <div
                  key={vRow.key}
                  data-index={vRow.index}
                  ref={virtualizer.measureElement}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${vRow.start}px)` }}
                >
                  <div className="ms-msglist">
                    {item.kind === "date" ? (
                      <div className="ms-date-sep"><span>{item.label}</span></div>
                    ) : (
                      <MessageRow
                        msg={item.msg}
                        firstInRun={item.firstInRun}
                        lastInRun={item.lastInRun}
                        endsBlock={item.endsBlock}
                        palette={palette}
                        density={density}
                        profile={profile}
                        onJump={handleCallJump}
                        onScrollToMsg={scrollToMsg}
                        onOpenMedia={handleOpenMedia}
                        highlight={highlightId === item.msg.id}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </>
        )}
      </div>

      <div className="ms-thread-composer" aria-hidden="true">
        <div className="ms-composer-lock">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M6 1.2 C7.7 1.2 9 2.5 9 4.2 V5.4 H9.4 A.6.6 0 0 1 10 6 V10 A.6.6 0 0 1 9.4 10.6 H2.6 A.6.6 0 0 1 2 10 V6 A.6.6 0 0 1 2.6 5.4 H3 V4.2 C3 2.5 4.3 1.2 6 1.2 Z" fill="currentColor"/>
          </svg>
          <span>This is an archive — replies aren't sent anywhere</span>
        </div>
      </div>

      {viewerIdx >= 0 && mediaList[viewerIdx] && (
        <MediaViewer
          items={mediaList}
          index={viewerIdx}
          palette={palette}
          onClose={() => setViewerIdx(-1)}
          onIndex={setViewerIdx}
          onJumpToMessage={(mid) => scrollToMsg(mid)}
        />
      )}
    </section>
  );
}
