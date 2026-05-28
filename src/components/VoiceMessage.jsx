import { useState, useEffect, useRef, useMemo } from "react";
import { fmtAudioDuration, strHash } from "../utils/format.js";
import { resolveUri, isZipReady } from "../utils/mediaStore.js";

export default function VoiceMessage({ audio, mine }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [resolvedUri, setResolvedUri] = useState(() => {
    const u = audio.uri;
    return u && (u.startsWith("blob:") || u.startsWith("http")) ? u : null;
  });
  const trackRef = useRef(null);
  const tickRef = useRef(null);
  const audioRef = useRef(null);
  const dur = audio.duration_s || 30;

  useEffect(() => {
    const u = audio.uri;
    if (u && (u.startsWith("blob:") || u.startsWith("http"))) { setResolvedUri(u); return; }
    let cancelled = false;
    let timerId;
    const attempt = () => {
      resolveUri(u).then((r) => {
        if (cancelled) return;
        if (r) setResolvedUri(r);
        else if (!isZipReady()) timerId = setTimeout(attempt, 600);
      });
    };
    attempt();
    return () => { cancelled = true; clearTimeout(timerId); };
  }, [audio.uri]);

  const isBlobUrl = !!resolvedUri;

  // Reset state when audio source changes
  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setLoading(false);
    setErrored(false);
  }, [audio.uri]);

  // Build Audio element for real URIs
  useEffect(() => {
    if (!resolvedUri) return;
    const el = new Audio(resolvedUri);
    el.preload = "metadata";
    el.addEventListener("timeupdate", () => {
      if (el.duration && isFinite(el.duration)) setProgress(el.currentTime / el.duration);
    });
    el.addEventListener("ended", () => {
      setPlaying(false);
      setLoading(false);
      setTimeout(() => setProgress(0), 250);
    });
    el.addEventListener("error", () => {
      setErrored(true);
      setPlaying(false);
      setLoading(false);
    });
    el.addEventListener("canplay", () => setLoading(false));
    audioRef.current = el;
    return () => { el.pause(); el.src = ""; audioRef.current = null; };
  }, [resolvedUri]);

  // Drive playback
  useEffect(() => {
    if (!isBlobUrl) {
      if (!playing || scrubbing) { clearInterval(tickRef.current); return; }
      const startedAt = Date.now() - progress * dur * 1000;
      tickRef.current = setInterval(() => {
        const p = (Date.now() - startedAt) / (dur * 1000);
        if (p >= 1) { setProgress(1); setPlaying(false); setTimeout(() => setProgress(0), 250); clearInterval(tickRef.current); }
        else setProgress(p);
      }, 50);
      return () => clearInterval(tickRef.current);
    }
    const el = audioRef.current;
    if (!el) return;
    if (playing && !scrubbing) {
      setLoading(true);
      el.play()
        .then(() => setLoading(false))
        .catch(() => { setLoading(false); setPlaying(false); });
    } else {
      el.pause();
      setLoading(false);
    }
  }, [playing, scrubbing, isBlobUrl]);

  const seed = strHash(audio.uri || "x");
  const bars = useMemo(() => {
    const n = 28;
    return Array.from({ length: n }, (_, i) => {
      const x = (seed + i * 9301 + 49297) % 233280;
      const r = x / 233280;
      const env = Math.sin((i / n) * Math.PI) * 0.4 + 0.3;
      return Math.max(0.18, Math.min(1, env + r * 0.55));
    });
  }, [seed]);

  function pxToProgress(clientX) {
    const el = trackRef.current;
    if (!el) return 0;
    const wave = el.querySelector(".ms-voice-wave");
    const rect = (wave || el).getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function handlePointerDown(e) {
    e.preventDefault();
    setScrubbing(true);
    const p = pxToProgress(e.clientX);
    setProgress(p);
    const el = audioRef.current;
    if (isBlobUrl && el && el.duration && isFinite(el.duration)) el.currentTime = p * el.duration;
    e.target.setPointerCapture?.(e.pointerId);
  }
  function handlePointerMove(e) {
    if (!scrubbing) return;
    const p = pxToProgress(e.clientX);
    setProgress(p);
    const el = audioRef.current;
    if (isBlobUrl && el && el.duration && isFinite(el.duration)) el.currentTime = p * el.duration;
  }
  function handlePointerUp() {
    if (!scrubbing) return;
    setScrubbing(false);
  }

  function handlePlayClick() {
    if (errored) return;
    if (progress >= 1) {
      setProgress(0);
      if (isBlobUrl && audioRef.current) audioRef.current.currentTime = 0;
    }
    setPlaying((p) => !p);
  }

  const elapsed = fmtAudioDuration(dur * progress);
  const remaining = fmtAudioDuration(dur * (1 - progress));

  return (
    <div className={`ms-voice ${mine ? "ms-voice-mine" : ""} ${errored ? "ms-voice-errored" : ""}`}>
      <button
        className="ms-voice-play"
        onClick={handlePlayClick}
        disabled={errored}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        {loading ? (
          <svg viewBox="0 0 16 16" width="12" height="12" className="ms-voice-spin"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="18 12" strokeLinecap="round"/></svg>
        ) : errored ? (
          <svg viewBox="0 0 16 16" width="13" height="13"><path d="M8 4 V9 M8 12 V12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        ) : playing ? (
          <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"/></svg>
        ) : (
          <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 2.2 v11.6 a.5.5 0 0 0 .77.42 l9-5.8 a.5.5 0 0 0 0-.84 l-9-5.8 A.5.5 0 0 0 3 2.2z" fill="currentColor"/></svg>
        )}
      </button>
      <div
        ref={trackRef}
        className={`ms-voice-track ${scrubbing ? "ms-voice-track-scrub" : ""}`}
        onPointerDown={errored ? undefined : handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label="Voice message progress"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
      >
        <div className="ms-voice-wave" aria-hidden="true">
          {bars.map((b, i) => (
            <span
              key={i}
              className={`ms-voice-bar ${i / bars.length <= progress ? "ms-voice-bar-on" : ""}`}
              style={{ height: `${b * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className="ms-voice-time" title={`${elapsed} elapsed`}>
        {errored ? "—" : (progress > 0 && progress < 1 ? elapsed : remaining)}
      </div>
      {isBlobUrl && !errored && (
        <button
          className="ms-voice-dl"
          onClick={(e) => {
            e.stopPropagation();
            const a = document.createElement("a");
            a.href = resolvedUri;
            a.download = `voice-${strHash(audio.uri)}.m4a`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
          }}
          title="Download voice memo"
          aria-label="Download voice memo"
        >
          <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
            <path d="M8 2 V10 M4.5 7.5 L8 11 L11.5 7.5 M3 14 H13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}
