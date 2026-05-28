export function fmtTime(ms) {
  const d = new Date(ms);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function fmtRelative(ms) {
  const diff = Date.now() - ms;
  if (diff < 60 * 1000) return "just now";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)}d`;
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDateHeader(ms) {
  const d = new Date(ms);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yest = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  const diffDays = Math.floor((today - d) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  if (d.getFullYear() === today.getFullYear())
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function fmtFullDateTime(ms) {
  const d = new Date(ms);
  return (
    d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }) +
    " · " +
    fmtTime(ms)
  );
}

export function fmtYearRange(startMs, endMs) {
  const s = new Date(startMs).getFullYear();
  const e = new Date(endMs).getFullYear();
  return s === e ? `${s}` : `${s} – ${e}`;
}

export function fmtAudioDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function fmtCallDuration(secs) {
  if (!secs) return "0s";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function placeholderSrc(uri, w, h, palette) {
  const seed = strHash(uri || "x");
  const bg = palette ? palette.placeholderBg : "#e8dcc6";
  const fg = palette ? palette.placeholderFg : "#b8836b";
  const stripeAngle = (seed % 7) * 15 - 45;
  const stripeW = 10 + (seed % 6);
  const minDim = Math.min(w, h);
  const sw = Math.max(2, minDim * 0.008);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='xMidYMid slice'>
    <defs>
      <pattern id='p${seed}' patternUnits='userSpaceOnUse' width='${stripeW * 2}' height='${stripeW * 2}' patternTransform='rotate(${stripeAngle})'>
        <rect width='${stripeW * 2}' height='${stripeW * 2}' fill='${bg}'/>
        <rect width='${stripeW}' height='${stripeW * 2}' fill='${fg}' opacity='0.32'/>
      </pattern>
    </defs>
    <rect width='${w}' height='${h}' fill='${bg}'/>
    <rect width='${w}' height='${h}' fill='url(#p${seed})' opacity='0.85'/>
    <g transform='translate(${w / 2}, ${h / 2})' opacity='0.55'>
      <rect x='${-minDim * 0.12}' y='${-minDim * 0.1}' width='${minDim * 0.24}' height='${minDim * 0.2}' rx='${minDim * 0.02}' fill='none' stroke='${fg}' stroke-width='${sw}'/>
      <circle cx='${-minDim * 0.04}' cy='${-minDim * 0.03}' r='${minDim * 0.025}' fill='${fg}'/>
      <path d='M ${-minDim * 0.1} ${minDim * 0.07} L ${-minDim * 0.02} ${-minDim * 0.01} L ${minDim * 0.04} ${minDim * 0.05} L ${minDim * 0.11} ${-minDim * 0.04} L ${minDim * 0.12} ${minDim * 0.09} Z' fill='${fg}'/>
    </g>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
