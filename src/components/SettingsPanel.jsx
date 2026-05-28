import { useEffect } from "react";

const BG_OPTIONS = [
  { id: "none",     label: "Plain" },
  { id: "dots",     label: "Dots" },
  { id: "grid",     label: "Grid" },
  { id: "lines",    label: "Lines" },
  { id: "diagonal", label: "Diagonal" },
];

function Sec({ title, children }) {
  return (
    <section className="ms-sp-sec">
      <h4 className="ms-sp-sec-title">{title}</h4>
      {children}
    </section>
  );
}

function Row({ label, children }) {
  return (
    <div className="ms-sp-row">
      <span className="ms-sp-row-label">{label}</span>
      <div className="ms-sp-row-ctrl">{children}</div>
    </div>
  );
}

function ChipRow({ options, value, onChange }) {
  return (
    <div className="ms-sp-chips">
      {options.map(([v, label]) => (
        <button
          key={v}
          className={`ms-sp-chip ${value === v ? "ms-sp-chip-on" : ""}`}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPanel({ open, onClose, tweaks, onChange, palettes, profile }) {
  const set = (key) => (val) => onChange((t) => ({ ...t, [key]: val }));

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className="ms-sp-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="ms-sp" aria-hidden={!open} aria-label="Settings">
        <div className="ms-sp-head">
          <h3>Settings</h3>
          <button className="ms-sp-x" onClick={onClose} aria-label="Close settings">×</button>
        </div>

        <div className="ms-sp-body">

          {/* ── Theme ── */}
          <Sec title="Theme">
            <div className="ms-sp-palettes">
              {Object.entries(palettes).map(([key, p]) => (
                <button
                  key={key}
                  className={`ms-sp-palette ${tweaks.palette === key ? "ms-sp-palette-on" : ""}`}
                  onClick={() => set("palette")(key)}
                  title={p.name}
                >
                  <span className="ms-sp-palette-bg" style={{ background: p.bg }} />
                  <span className="ms-sp-palette-bubble" style={{ background: p.bubbleTheirs }} />
                  <span className="ms-sp-palette-accent" style={{ background: p.accent }} />
                  <span className="ms-sp-palette-name">{p.name}</span>
                </button>
              ))}
            </div>
          </Sec>

          {/* ── Typography ── */}
          <Sec title="Typography">
            <Row label="Font">
              <ChipRow
                options={[["sans", "Sans"], ["serif", "Serif"], ["mono", "Mono"]]}
                value={tweaks.msgFont}
                onChange={set("msgFont")}
              />
            </Row>
            <Row label={`Size — ${tweaks.fontSize}px`}>
              <input type="range" className="ms-sp-slider" min={13} max={19}
                value={tweaks.fontSize}
                onChange={(e) => set("fontSize")(+e.target.value)} />
            </Row>
            <Row label="Density">
              <ChipRow
                options={[["compact", "Compact"], ["regular", "Regular"], ["cozy", "Cozy"]]}
                value={tweaks.density}
                onChange={set("density")}
              />
            </Row>
          </Sec>

          {/* ── Bubbles ── */}
          <Sec title="Bubbles">
            <Row label="Shape">
              <ChipRow
                options={[["soft", "Soft"], ["paper", "Paper"], ["sharp", "Sharp"]]}
                value={tweaks.bubbleShape}
                onChange={set("bubbleShape")}
              />
            </Row>
            <Row label={`Max width — ${tweaks.bubbleMax}px`}>
              <input type="range" className="ms-sp-slider" min={320} max={640} step={20}
                value={tweaks.bubbleMax}
                onChange={(e) => set("bubbleMax")(+e.target.value)} />
            </Row>
          </Sec>

          {/* ── Chat background ── */}
          <Sec title="Chat background">
            <div className="ms-sp-bg-grid">
              {BG_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  className={`ms-sp-bg-opt ${tweaks.chatBg === id ? "ms-sp-bg-opt-on" : ""}`}
                  onClick={() => set("chatBg")(id)}
                >
                  <div className="ms-sp-bg-preview" data-bg={id} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </Sec>

          {/* ── Your profile ── */}
          {profile && (
            <Sec title="Your profile">
              <Row label="Display name">
                <input
                  type="text"
                  className="ms-sp-input"
                  value={tweaks.displayName || ""}
                  onChange={(e) => set("displayName")(e.target.value)}
                  placeholder={profile.displayName || "You"}
                  spellCheck={false}
                />
              </Row>
              {profile.handle && profile.handle !== "you" && (
                <div className="ms-sp-handle">@{profile.handle}</div>
              )}
            </Sec>
          )}

        </div>
      </aside>
    </>
  );
}
