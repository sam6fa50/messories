import { placeholderSrc, fmtAudioDuration } from "../utils/format.js";

function tile(it, i, palette, onOpenItem, opts = {}) {
  const isBlobUrl = it.uri && (it.uri.startsWith("blob:") || it.uri.startsWith("http"));
  const bg = isBlobUrl
    ? `url("${it.uri}")`
    : `url("${placeholderSrc(it.uri, it.width || 1080, it.height || 1080, palette)}")`;
  return (
    <button
      key={i}
      type="button"
      className={`ms-photo ms-photo-tile ${opts.tileCls || ""}`}
      onClick={(e) => { e.stopPropagation(); onOpenItem?.(i); }}
      style={{ backgroundImage: bg, ...(opts.style || {}) }}
      aria-label={it.isVideo ? "Open video" : "Open photo"}
    >
      {it.isVideo && (
        <span className="ms-media-playoverlay" aria-hidden="true">
          <span className="ms-media-playicon">
            <svg width="14" height="14" viewBox="0 0 16 16"><path d="M5 3 V13 L13 8 Z" fill="currentColor"/></svg>
          </span>
          {it.duration_s ? <span className="ms-media-duration">{fmtAudioDuration(it.duration_s)}</span> : null}
        </span>
      )}
    </button>
  );
}

export default function MediaBlock({ photos, videos, palette, onOpenItem }) {
  const items = [];
  (photos || []).forEach((p) => items.push({ ...p, isVideo: false }));
  (videos || []).forEach((v) => items.push({ ...v, isVideo: true }));
  const n = items.length;
  if (n === 0) return null;

  if (n === 1) {
    const it = items[0];
    const ar = `${it.width || 4} / ${it.height || 3}`;
    return (
      <div className="ms-media-single" style={{ aspectRatio: ar, maxHeight: 320 }}>
        {tile(it, 0, palette, onOpenItem, { tileCls: "ms-photo-1", style: { aspectRatio: ar, width: "100%", height: "100%" } })}
      </div>
    );
  }

  const cls = n === 2 ? "ms-photo-2" : n === 3 ? "ms-photo-3" : "ms-photo-4";
  return (
    <div className={`ms-photo-grid ${cls}`}>
      {items.slice(0, 4).map((it, i) => tile(it, i, palette, onOpenItem))}
    </div>
  );
}
