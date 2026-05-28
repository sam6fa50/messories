export default function Avatar({ name, color, initials, src, size = 28 }) {
  const inits =
    initials ||
    name
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  if (src) {
    return (
      <div
        className="ms-avatar ms-avatar-img"
        style={{ width: size, height: size, backgroundImage: `url("${src}")` }}
        aria-hidden="true"
      />
    );
  }
  return (
    <div
      className="ms-avatar"
      style={{ width: size, height: size, background: color || "#b8836b", fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {inits}
    </div>
  );
}
