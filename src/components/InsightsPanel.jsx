import { useMemo, useState, useEffect } from "react";
import { threadStats } from "../utils/stats.js";
import { fmtCallDuration, placeholderSrc } from "../utils/format.js";
import { exportMarkdown, exportPhotosZip, exportPrint } from "../utils/export.js";

const WINDOWS = [
  { label: "3 mo",    ms: 90  * 86_400_000 },
  { label: "1 yr",    ms: 365 * 86_400_000 },
  { label: "All time", ms: 0 },
];

export default function InsightsPanel({ thread, palette, onClose, open }) {
  const [winIdx, setWinIdx] = useState(1); // default: 1 year
  const [stats, setStats]   = useState(null);
  const [busy,  setBusy]    = useState(false);
  const [photoState, setPhotoState] = useState(null);

  // Defer heavy computation so React can render the loading skeleton first
  useEffect(() => {
    setBusy(true);
    setStats(null);
    const id = setTimeout(() => {
      const since = WINDOWS[winIdx].ms ? Date.now() - WINDOWS[winIdx].ms : 0;
      setStats(threadStats(thread, since));
      setBusy(false);
    }, 0);
    return () => clearTimeout(id);
  }, [thread.id, winIdx]);

  const media = useMemo(() => {
    const since = WINDOWS[winIdx].ms ? Date.now() - WINDOWS[winIdx].ms : 0;
    const out = [];
    thread.messages.forEach((m) => {
      if (since && m.timestamp_ms < since) return;
      if (m.photos) m.photos.forEach((p) => out.push({ ...p, isVideo: false, ts: m.timestamp_ms }));
      if (m.videos) m.videos.forEach((v) => out.push({ ...v, isVideo: true,  ts: m.timestamp_ms }));
    });
    return out;
  }, [thread.id, winIdx]);

  async function handlePhotos() {
    setPhotoState("loading");
    const result = await exportPhotosZip(thread, null);
    if (result === "none") {
      setPhotoState("none");
      setTimeout(() => setPhotoState(null), 3000);
    } else {
      setPhotoState(null);
    }
  }

  const maxHist = stats ? Math.max(...stats.hist, 1) : 1;
  const isPartial = WINDOWS[winIdx].ms > 0;

  return (
    <>
      <div className="ms-insights-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="ms-insights" aria-hidden={!open}>
        <div className="ms-insights-head">
          <h3>Insights</h3>
          <button className="ms-insights-x" onClick={onClose} aria-label="Close insights">×</button>
        </div>

        {/* Time window selector */}
        <div className="ms-insights-window">
          {WINDOWS.map((w, i) => (
            <button
              key={w.label}
              className={`ms-win-chip ${winIdx === i ? "ms-win-chip-on" : ""}`}
              onClick={() => setWinIdx(i)}
            >
              {w.label}
            </button>
          ))}
          {stats && isPartial && (
            <span className="ms-win-count">
              {stats.windowed.toLocaleString()} / {thread.total_messages.toLocaleString()} msgs
            </span>
          )}
        </div>

        <div className="ms-insights-body">
          {busy ? (
            <div className="ms-insights-loading">
              <span className="ms-parse-spin" aria-hidden="true" />
              <span>Computing…</span>
            </div>
          ) : stats ? (
            <>
              <div className="ms-stat-grid">
                <div className="ms-stat-card"><div className="ms-stat-num">{isPartial ? stats.windowed.toLocaleString() : stats.total.toLocaleString()}</div><div className="ms-stat-lbl">messages</div></div>
                <div className="ms-stat-card"><div className="ms-stat-num">{stats.yearRange}</div><div className="ms-stat-lbl">span</div></div>
                <div className="ms-stat-card"><div className="ms-stat-num">{(stats.imgs + stats.vids).toLocaleString()}</div><div className="ms-stat-lbl">media</div></div>
                <div className="ms-stat-card"><div className="ms-stat-num">{stats.voice.toLocaleString()}</div><div className="ms-stat-lbl">voice notes</div></div>
              </div>

              <section className="ms-insights-sec">
                <h4>When you talk</h4>
                <div className="ms-hist">
                  {stats.hist.map((v, i) => (
                    <div className="ms-hist-col" key={i}>
                      <span className="ms-hist-bar" style={{ height: `${(v / maxHist) * 100}%` }} title={`${i}:00 — ${v} messages`} />
                    </div>
                  ))}
                </div>
                <div className="ms-hist-axis"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span></div>
              </section>

              <section className="ms-insights-sec">
                <h4>Who said what</h4>
                <div className="ms-sender-list">
                  {Object.entries(stats.senders).sort((a, b) => b[1] - a[1]).map(([who, count]) => {
                    const total = Object.values(stats.senders).reduce((a, b) => a + b, 0);
                    const pct = total ? (count / total) * 100 : 0;
                    return (
                      <div className="ms-sender-row" key={who}>
                        <span className="ms-sender-name">{who}</span>
                        <span className="ms-sender-track"><span className="ms-sender-fill" style={{ width: `${pct}%` }} /></span>
                        <span className="ms-sender-num">{Math.round(pct)}%</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {stats.topEmoji.length > 0 && (
                <section className="ms-insights-sec">
                  <h4>Top reactions</h4>
                  <div className="ms-emoji-list">
                    {stats.topEmoji.map(([e, n]) => (
                      <span className="ms-emoji-pill" key={e}>
                        <span className="ms-emoji-glyph">{e}</span>
                        <span className="ms-emoji-num">×{n}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {stats.calls.total > 0 && (
                <section className="ms-insights-sec">
                  <h4>Calls</h4>
                  <div className="ms-call-stats">
                    <div className="ms-call-stat"><div className="ms-call-stat-num">{stats.calls.total}</div><div className="ms-call-stat-lbl">total calls</div></div>
                    <div className="ms-call-stat"><div className="ms-call-stat-num">{fmtCallDuration(stats.calls.secondsOnCall)}</div><div className="ms-call-stat-lbl">on the line</div></div>
                  </div>
                  <div className="ms-call-split">
                    <div className="ms-call-split-bar" aria-hidden="true">
                      {stats.calls.video > 0 && <span className="ms-call-split-v" style={{ width: `${(stats.calls.video / stats.calls.total) * 100}%` }} title={`${stats.calls.video} video calls`} />}
                      {stats.calls.audio > 0 && <span className="ms-call-split-a" style={{ width: `${(stats.calls.audio / stats.calls.total) * 100}%` }} title={`${stats.calls.audio} audio calls`} />}
                    </div>
                    <div className="ms-call-split-legend">
                      <span><span className="ms-dot ms-dot-v" />{stats.calls.video} video</span>
                      <span><span className="ms-dot ms-dot-a" />{stats.calls.audio} audio</span>
                      {stats.calls.missed > 0 && <span className="ms-call-missed-lbl">· {stats.calls.missed} missed</span>}
                    </div>
                  </div>
                  {stats.calls.longestCall > 0 && (
                    <div className="ms-call-longest">Longest:&nbsp;<em>{fmtCallDuration(stats.calls.longestCall)}</em>&nbsp;{stats.calls.longestCallVideo ? "video" : "audio"} call</div>
                  )}
                </section>
              )}

              {media.length > 0 && (
                <section className="ms-insights-sec">
                  <h4>Media · {media.length}</h4>
                  <div className="ms-media-grid">
                    {media.slice(0, 12).map((item, i) => {
                      const isBlobUrl = item.uri && (item.uri.startsWith("blob:") || item.uri.startsWith("http"));
                      const bg = isBlobUrl
                        ? `url("${item.uri}")`
                        : `url("${placeholderSrc(item.uri, 400, 400, palette)}")`;
                      return (
                        <div key={i} className="ms-media-tile" style={{ backgroundImage: bg }}>
                          {item.isVideo && (
                            <span className="ms-media-tile-vid" aria-hidden="true">
                              <svg viewBox="0 0 10 10" width="10" height="10"><path d="M2.5 1.5 L8.5 5 L2.5 8.5 Z" fill="currentColor"/></svg>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="ms-insights-sec">
                <h4>Export</h4>
                <div className="ms-export-row">
                  <button className="ms-btn-quiet" onClick={() => exportPrint(thread)}>As PDF</button>
                  <button className="ms-btn-quiet" onClick={() => exportMarkdown(thread)}>As markdown</button>
                  <button
                    className="ms-btn-quiet"
                    onClick={handlePhotos}
                    disabled={photoState === "loading"}
                  >
                    {photoState === "loading" ? "Zipping…" : photoState === "none" ? "No media found" : "Just photos"}
                  </button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}
