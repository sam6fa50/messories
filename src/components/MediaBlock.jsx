import { useState, useEffect } from "react";
import { placeholderSrc, fmtAudioDuration } from "../utils/format.js";
import { resolveUri } from "../utils/mediaStore.js";

function MediaTile({ item, index, palette, onOpenItem, tileCls, style }) {
  const [src, setSrc] = useState(() => {
    const u = item.uri;
    return u && (u.startsWith("blob:") || u.startsWith("http")) ? u : null;
  });

  useEffect(() => {
    if (src) return;
    resolveUri(item.uri).then((r) => { if (r) setSrc(r); });
  }, [item.uri]);

  const bg = src
    ? `url("${src}")`
    : `url("${placeholderSrc(item.uri, item.width || 1080, item.height || 1080, palette)}")`;

  return (
    <button
      type="button"
      className={`ms-photo ms-photo-tile ${tileCls || ""}`}
      onClick={(e) => { e.stopPropagation(); onOpenItem?.(index); }}
      style={{ backgroundImage: bg, ...style }}
      aria-label={item.isVideo ? "Open video" : "Open photo"}
    >
      {item.isVideo && (
        <span className="ms-media-playoverlay" aria-hidden="true">
          <span className="ms-media-playicon">
            <svg width="14" height="14" viewBox="0 0 16 16"><path d="M5 3 V13 L13 8 Z" fill="currentColor"/></svg>
          </span>
          {item.duration_s ? <span className="ms-media-duration">{fmtAudioDuration(item.duration_s)}</span> : null}
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
        <MediaTile item={it} index={0} palette={palette} onOpenItem={onOpenItem}
          tileCls="ms-photo-1" style={{ aspectRatio: ar, width: "100%", height: "100%" }} />
      </div>
    );
  }

  const cls = n === 2 ? "ms-photo-2" : n === 3 ? "ms-photo-3" : "ms-photo-4";
  return (
    <div className={`ms-photo-grid ${cls}`}>
      {items.slice(0, 4).map((it, i) => (
        <MediaTile key={i} item={it} index={i} palette={palette} onOpenItem={onOpenItem} />
      ))}
    </div>
  );
}
