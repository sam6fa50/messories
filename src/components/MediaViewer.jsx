import { useEffect, useRef, useCallback, useState } from "react";
import { fmtTime, fmtDateHeader, fmtFullDateTime, fmtAudioDuration, placeholderSrc } from "../utils/format.js";
import { resolveUri, isZipReady } from "../utils/mediaStore.js";

// ── Video player with custom controls ───────────────────────────────────────

function VideoPlayer({ item, palette }) {
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const tickRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(item.duration_s || 30);
  const [scrubbing, setScrubbing] = useState(false);

  const [resolvedUri, setResolvedUri] = useState(() => {
    const u = item.uri;
    return u && (u.startsWith("blob:") || u.startsWith("http")) ? u : null;
  });
  useEffect(() => {
    const u = item.uri;
    if (u && (u.startsWith("blob:") || u.startsWith("http"))) { setResolvedUri(u); return; }
    setResolvedUri(null);
    let cancelled = false, timerId;
    const attempt = () => resolveUri(u).then((r) => {
      if (cancelled) return;
      if (r) setResolvedUri(r);
      else if (!isZipReady()) timerId = setTimeout(attempt, 600);
    });
    attempt();
    return () => { cancelled = true; clearTimeout(timerId); };
  }, [item.uri]);

  const isBlobUrl = !!resolvedUri;
  const aspect = item.width && item.height ? `${item.width} / ${item.height}` : "4 / 3";

  useEffect(() => {
    setPlaying(false); setProgress(0); setDuration(item.duration_s || 30);
    clearInterval(tickRef.current);
  }, [item.uri]);

  useEffect(() => {
    if (!resolvedUri) return;
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => { if (vid.duration) setProgress(vid.currentTime / vid.duration); };
    const onDur = () => { if (vid.duration && isFinite(vid.duration)) setDuration(vid.duration); };
    const onEnd = () => { setPlaying(false); setTimeout(() => setProgress(0), 300); };
    vid.addEventListener("timeupdate", onTime);
    vid.addEventListener("durationchange", onDur);
    vid.addEventListener("ended", onEnd);
    return () => {
      vid.removeEventListener("timeupdate", onTime);
      vid.removeEventListener("durationchange", onDur);
      vid.removeEventListener("ended", onEnd);
    };
  }, [resolvedUri]);

  useEffect(() => {
    if (!isBlobUrl) return;
    const vid = videoRef.current;
    if (!vid) return;
    if (playing && !scrubbing) vid.play().catch(() => {});
    else vid.pause();
  }, [playing, scrubbing, isBlobUrl]);

  useEffect(() => {
    if (isBlobUrl) return;
    if (!playing || scrubbing) { clearInterval(tickRef.current); return; }
    const startedAt = Date.now() - progress * duration * 1000;
    tickRef.current = setInterval(() => {
      const p = (Date.now() - startedAt) / (duration * 1000);
      if (p >= 1) { setProgress(1); setPlaying(false); setTimeout(() => setProgress(0), 300); clearInterval(tickRef.current); }
      else setProgress(p);
    }, 50);
    return () => clearInterval(tickRef.current);
  }, [playing, scrubbing, isBlobUrl, duration]);

  function pxToProgress(clientX) {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }
  function onTrackDown(e) {
    e.preventDefault(); e.stopPropagation();
    setScrubbing(true);
    const p = pxToProgress(e.clientX);
    setProgress(p);
    if (isBlobUrl && videoRef.current?.duration) videoRef.current.currentTime = p * videoRef.current.duration;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onTrackMove(e) {
    if (!scrubbing) return;
    const p = pxToProgress(e.clientX);
    setProgress(p);
    if (isBlobUrl && videoRef.current?.duration) videoRef.current.currentTime = p * videoRef.current.duration;
  }
  function onTrackUp() {
    if (!scrubbing) return;
    setScrubbing(false);
    if (!playing && progress < 1) setPlaying(true);
  }
  function togglePlay(e) {
    e.stopPropagation();
    if (progress >= 1) setProgress(0);
    setPlaying((p) => !p);
  }

  const elapsed = fmtAudioDuration(duration * progress);
  const remaining = fmtAudioDuration(duration * (1 - progress));

  return (
    <div className="ms-mv-frame ms-mv-vidframe" style={{ aspectRatio: aspect }} data-paused={!playing ? "" : undefined}>
      {resolvedUri ? (
        <video ref={videoRef} src={resolvedUri} playsInline preload="metadata"
          style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "6px 6px 0 0", display: "block" }}
          onClick={togglePlay} />
      ) : (
        <div className="ms-mv-img"
          style={{ backgroundImage: `url("${placeholderSrc(item.uri, item.width, item.height, palette)}")`, borderRadius: "6px 6px 0 0" }}
          onClick={togglePlay} />
      )}
      {!playing && (
        <button className="ms-mv-bigplay" onClick={togglePlay} aria-label="Play video">
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 V20 L20 12 Z" fill="currentColor"/></svg>
        </button>
      )}
      <div className="ms-mv-controls" onClick={(e) => e.stopPropagation()}>
        <button className="ms-mv-ctrl-play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing
            ? <svg viewBox="0 0 16 16" width="13" height="13"><rect x="2.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="10" y="2" width="3.5" height="12" rx="1" fill="currentColor"/></svg>
            : <svg viewBox="0 0 16 16" width="13" height="13"><path d="M3.5 2V14l10-6z" fill="currentColor"/></svg>
          }
        </button>
        <div ref={trackRef} className={`ms-mv-ctrl-track${scrubbing ? " ms-mv-ctrl-scrub" : ""}`}
          onPointerDown={onTrackDown} onPointerMove={onTrackMove} onPointerUp={onTrackUp} onPointerCancel={onTrackUp}
          role="slider" aria-label="Video progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="ms-mv-ctrl-rail" />
          <div className="ms-mv-ctrl-fill" style={{ width: `${progress * 100}%` }} />
          <div className="ms-mv-ctrl-thumb" style={{ left: `${progress * 100}%` }} />
        </div>
        <span className="ms-mv-ctrl-time">{progress > 0 && progress < 1 ? elapsed : remaining}</span>
      </div>
    </div>
  );
}

// ── Zoomable photo frame ─────────────────────────────────────────────────────

function ZoomablePhoto({ item, palette }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [resolvedUri, setResolvedUri] = useState(() => {
    const u = item.uri;
    return u && (u.startsWith("blob:") || u.startsWith("http")) ? u : null;
  });
  const wrapRef = useRef(null);
  const dragAnchor = useRef(null);
  const lastPinchDist = useRef(null);

  useEffect(() => {
    const u = item.uri;
    if (u && (u.startsWith("blob:") || u.startsWith("http"))) { setResolvedUri(u); return; }
    setResolvedUri(null);
    let cancelled = false, timerId;
    const attempt = () => resolveUri(u).then((r) => {
      if (cancelled) return;
      if (r) setResolvedUri(r);
      else if (!isZipReady()) timerId = setTimeout(attempt, 600);
    });
    attempt();
    return () => { cancelled = true; clearTimeout(timerId); };
  }, [item.uri]);

  const isBlobUrl = !!resolvedUri;
  const aspect = item.width && item.height ? `${item.width} / ${item.height}` : "4 / 3";

  useEffect(() => { setScale(1); setOffset({ x: 0, y: 0 }); }, [item.uri]);

  const reset = useCallback(() => { setScale(1); setOffset({ x: 0, y: 0 }); }, []);

  // Scroll-wheel / trackpad pinch → zoom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setScale((prev) => {
        const next = Math.max(1, prev * factor);
        if (next <= 1) setOffset({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Mouse drag to pan
  const onMouseDown = useCallback((e) => {
    if (scale <= 1) return;
    e.preventDefault();
    dragAnchor.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    setIsPanning(true);
  }, [scale, offset]);

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e) => {
      if (!dragAnchor.current) return;
      setOffset({ x: e.clientX - dragAnchor.current.x, y: e.clientY - dragAnchor.current.y });
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isPanning]);

  // Touch: pinch to zoom + single-finger drag when zoomed
  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      lastPinchDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1 && scale > 1) {
      dragAnchor.current = { x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y };
    }
  }, [scale, offset]);

  const onTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && lastPinchDist.current != null) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / lastPinchDist.current;
      lastPinchDist.current = dist;
      setScale((prev) => Math.max(1, prev * factor));
    } else if (e.touches.length === 1 && scale > 1 && dragAnchor.current) {
      setOffset({ x: e.touches[0].clientX - dragAnchor.current.x, y: e.touches[0].clientY - dragAnchor.current.y });
    }
  }, [scale]);

  const onTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
    dragAnchor.current = null;
    setIsPanning(false);
    setScale((s) => { if (s < 1.05) { setOffset({ x: 0, y: 0 }); return 1; } return s; });
  }, []);

  const isZoomed = scale > 1.01;

  return (
    <div
      ref={wrapRef}
      className="ms-mv-zoomwrap"
      data-zoomed={isZoomed ? "" : undefined}
      data-panning={isPanning ? "" : undefined}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={isZoomed ? reset : undefined}
      onClick={(e) => { if (isZoomed) e.stopPropagation(); }}
    >
      <div
        className="ms-mv-frame"
        style={{
          aspectRatio: aspect,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: isPanning ? "none" : "transform .1s ease-out",
          willChange: isZoomed ? "transform" : "auto",
        }}
      >
        {resolvedUri ? (
          <img src={resolvedUri} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 6, userSelect: "none" }} draggable={false} />
        ) : (
          <div className="ms-mv-img" style={{ backgroundImage: `url("${placeholderSrc(item.uri, item.width, item.height, palette)}")` }} />
        )}
      </div>
      {isZoomed && (
        <div className="ms-mv-zoom-hint" aria-hidden="true">double-click to reset</div>
      )}
    </div>
  );
}

// ── Lazy thumbnail ───────────────────────────────────────────────────────────

function LazyThumb({ item, idx, active, palette, onSelect }) {
  const [src, setSrc] = useState(() => {
    const u = item.uri;
    return u && (u.startsWith("blob:") || u.startsWith("http")) ? u : null;
  });
  useEffect(() => {
    if (src) return;
    resolveUri(item.uri).then((r) => { if (r) setSrc(r); });
  }, [item.uri]);
  const bg = src ? `url("${src}")` : `url("${placeholderSrc(item.uri, 200, 200, palette)}")`;
  return (
    <button data-thumb-idx={idx} className={`ms-mv-thumb ${active ? "ms-mv-thumb-on" : ""}`} onClick={onSelect} aria-label={`Item ${idx + 1}`}>
      <div className="ms-mv-thumb-img" style={{ backgroundImage: bg }} />
      {item.isVideo && <span className="ms-mv-thumb-vid"><svg width="9" height="9" viewBox="0 0 10 10"><path d="M3 1.5 V8.5 L8.5 5 Z" fill="currentColor"/></svg></span>}
    </button>
  );
}

// ── Stage dispatcher ─────────────────────────────────────────────────────────

function MediaStage({ item, palette }) {
  if (item.isVideo) return <VideoPlayer item={item} palette={palette} />;
  return <ZoomablePhoto item={item} palette={palette} />;
}

// ── Main viewer ──────────────────────────────────────────────────────────────

export default function MediaViewer({ items, index, palette, onClose, onIndex, onJumpToMessage }) {
  const thumbRowRef = useRef(null);

  const step = useCallback((dir) => {
    if (!items.length) return;
    onIndex((index + dir + items.length) % items.length);
  }, [items.length, index, onIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  useEffect(() => {
    const row = thumbRowRef.current;
    if (!row) return;
    const el = row.querySelector(`[data-thumb-idx="${index}"]`);
    if (!el) return;
    const er = el.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    if (er.left < rr.left + 24 || er.right > rr.right - 24) {
      const target = el.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2;
      row.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    }
  }, [index]);

  if (!items.length) return null;
  const item = items[index];
  if (!item) return null;

  const handleDownload = async () => {
    const resolved = await resolveUri(item.uri);
    const href = resolved || item.uri;
    const a = document.createElement("a");
    a.href = href;
    const stem = (item.uri || "media").replace(/[^a-z0-9-]/gi, "_").slice(0, 40);
    a.download = `messories-${stem}${item.isVideo ? ".mp4" : ".jpg"}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleJump = () => {
    onClose();
    setTimeout(() => onJumpToMessage?.(item.msgId), 40);
  };

  return (
    <div className="ms-mv-overlay" role="dialog" aria-label="Media viewer" onClick={onClose}>
      {/* Top bar — stops propagation so clicks here don't close */}
      <div className="ms-mv-top" onClick={(e) => e.stopPropagation()}>
        <div className="ms-mv-counter">
          <span className="ms-mv-counter-num">{index + 1}</span>
          <span className="ms-mv-counter-sep">of</span>
          <span className="ms-mv-counter-total">{items.length}</span>
        </div>
        <div className="ms-mv-actions">
          <button className="ms-mv-action" onClick={handleJump} title="Jump to message in thread">
            <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4 H13.5 V11 A1 1 0 0 1 12.5 12 H6.2 L3.5 14 V12 A1 1 0 0 1 2.5 11 Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
            <span>In thread</span>
          </button>
          <button className="ms-mv-action" onClick={handleDownload} title="Download">
            <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 V10 M4.5 7 L8 10.5 L11.5 7 M3 13 H13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Download</span>
          </button>
          <button className="ms-mv-close" onClick={onClose} title="Close (Esc)">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {items.length > 1 && (
        <>
          <button className="ms-mv-arrow ms-mv-arrow-l" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous">
            <svg width="20" height="20" viewBox="0 0 16 16"><path d="M10 2 L4 8 L10 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className="ms-mv-arrow ms-mv-arrow-r" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next">
            <svg width="20" height="20" viewBox="0 0 16 16"><path d="M6 2 L12 8 L6 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </>
      )}

      {/* Stage — stops propagation (only backdrop closes) */}
      <div className="ms-mv-stage" onClick={(e) => e.stopPropagation()}>
        <MediaStage item={item} palette={palette} />
      </div>

      {/* Meta — stops propagation */}
      <div className="ms-mv-meta" onClick={(e) => e.stopPropagation()}>
        <div className="ms-mv-meta-line">
          <span className="ms-mv-sender">{item.senderName}</span>
          <span className="ms-mv-sep">·</span>
          <span className="ms-mv-time" title={fmtFullDateTime(item.ts)}>{fmtDateHeader(item.ts)}, {fmtTime(item.ts)}</span>
          {item.isVideo && (<><span className="ms-mv-sep">·</span><span className="ms-mv-kind">video · {fmtAudioDuration(item.duration_s || 0)}</span></>)}
        </div>
        {item.caption && <div className="ms-mv-caption">{item.caption}</div>}
      </div>

      {/* Thumbnails — stops propagation */}
      {items.length > 1 && (
        <div className="ms-mv-thumbs" onClick={(e) => e.stopPropagation()} ref={thumbRowRef}>
          {items.map((it, i) => (
            <LazyThumb key={i} item={it} idx={i} active={i === index} palette={palette} onSelect={() => onIndex(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
