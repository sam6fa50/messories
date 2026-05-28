import { useState, useEffect } from "react";
import { parseInstagramZip } from "../utils/parser.js";
import { saveArchive, loadSavedMeta, loadArchiveFile, clearArchive, fmtBytes, fmtAgo } from "../utils/storage.js";
import { clearZip } from "../utils/mediaStore.js";
import { archiveKey, getCachedMeta, clearParsed } from "../utils/db.js";

export default function Landing({ onLoadDemo, onDataLoaded }) {
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | reading | done | error
  const [filename, setFilename] = useState(null);
  const [progress, setProgress] = useState(0);
  const [readouts, setReadouts] = useState([]);
  const [error, setError] = useState(null);
  const [savedMeta, setSavedMeta] = useState(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadSavedMeta().then(setSavedMeta);
  }, []);

  async function handleFile(file) {
    setFilename(file.name);
    setPhase("reading");
    setReadouts([]);
    setProgress(0);
    setError(null);
    try {
      const result = await parseInstagramZip(file, (msg, pct) => {
        setReadouts((r) => [...r, msg]);
        setProgress(pct);
      });
      saveArchive(file);
      setPhase("done");
      setTimeout(() => onDataLoaded(result.threads, result.profile, result.archKey), 500);
    } catch (err) {
      setError(err.message || "Failed to parse archive.");
      setPhase("error");
    }
  }

  async function handleRestore() {
    setRestoring(true);
    // Fast path: check if parsed data is already in IDB — skip ZIP entirely
    const meta = await loadSavedMeta();
    if (meta) {
      const aKey = archiveKey(meta.name, meta.size);
      const cached = await getCachedMeta(aKey);
      if (cached?.threads?.length) {
        setPhase("done");
        setTimeout(() => onDataLoaded(cached.threads, cached.profile, cached.archKey), 300);
        setRestoring(false);
        return;
      }
    }
    // Slow path: load ZIP from IDB and parse
    const file = await loadArchiveFile();
    if (!file) { setRestoring(false); setSavedMeta(null); return; }
    await handleFile(file);
    setRestoring(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  return (
    <div className="ms-landing">
      <div className="ms-landing-bg" aria-hidden="true">
        <div className="ms-landing-grain" />
      </div>

      <header className="ms-landing-head">
        <div className="ms-brand ms-brand-big">
          <span className="ms-brand-mark">M</span>
          <span className="ms-brand-word">essories</span>
        </div>
        <nav className="ms-landing-nav">
          <a href="#privacy">privacy</a>
          <a href="#how">how it works</a>
        </nav>
      </header>

      <main className="ms-landing-main">
        <div className="ms-landing-left">
          <div className="ms-kicker">a quiet home for your message history</div>
          <h1 className="ms-headline">
            <span>Years</span>
            <span>of conversations,</span>
            <span><em>kept where they belong.</em></span>
          </h1>
          <p className="ms-lede">
            Messories reads your Instagram data export and renders it as a calm,
            searchable archive — reactions, voice notes, photos and all. Nothing
            ever leaves this tab.
          </p>

          <div className="ms-privacy-card" id="privacy">
            <div className="ms-privacy-card-head">
              <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M6 1.2 C7.7 1.2 9 2.5 9 4.2 V5.4 H9.4 A.6.6 0 0 1 10 6 V10 A.6.6 0 0 1 9.4 10.6 H2.6 A.6.6 0 0 1 2 10 V6 A.6.6 0 0 1 2.6 5.4 H3 V4.2 C3 2.5 4.3 1.2 6 1.2 Z M6 2.4 C5 2.4 4.2 3.2 4.2 4.2 V5.4 H7.8 V4.2 C7.8 3.2 7 2.4 6 2.4 Z" fill="currentColor"/>
              </svg>
              <span>Local-only, by design</span>
            </div>
            <ul className="ms-privacy-list">
              <li>Your archive is parsed entirely in this browser tab.</li>
              <li>No upload. No account. No telemetry.</li>
              <li>Close the tab and Messories forgets everything.</li>
            </ul>
          </div>
        </div>

        <div className="ms-landing-right">
          {phase === "idle" && (
            <>
              {savedMeta && (
                <div className="ms-restore">
                  <div className="ms-restore-info">
                    <div className="ms-restore-name">{savedMeta.name}</div>
                    <div className="ms-restore-meta">{fmtBytes(savedMeta.size)} · saved {fmtAgo(savedMeta.savedAt)}</div>
                  </div>
                  <div className="ms-restore-actions">
                    <button className="ms-btn ms-btn-primary" onClick={handleRestore} disabled={restoring}>
                      {restoring ? "Loading…" : "Restore →"}
                    </button>
                    <button className="ms-btn ms-btn-ghost ms-restore-clear" onClick={async () => { await clearArchive(); await clearParsed(); clearZip(); setSavedMeta(null); }} title="Forget saved archive" aria-label="Forget saved archive">×</button>
                  </div>
                </div>
              )}
              <div
                className={`ms-drop ${drag ? "ms-drop-on" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={handleDrop}
              >
                <div className="ms-drop-icon" aria-hidden="true">
                  <svg viewBox="0 0 48 48" width="36" height="36">
                    <path d="M10 30 V36 A2 2 0 0 0 12 38 H36 A2 2 0 0 0 38 36 V30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    <path d="M24 10 V28 M17 19 L24 12 L31 19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="ms-drop-title">Drop your Instagram export here</div>
                <div className="ms-drop-sub">.zip file from Instagram's data download</div>
                <div className="ms-drop-or">— or —</div>
                <div className="ms-drop-actions">
                  <label className="ms-btn ms-btn-primary">
                    <input type="file" accept=".zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                    Choose a file
                  </label>
                  <label className="ms-btn ms-btn-ghost">
                    <input type="file" webkitdirectory="true" directory="true" multiple onChange={(e) => {
                      const fs = e.target.files;
                      // Find any JSON file and process directory as a File
                      // For directories we need to construct the data manually
                      if (fs && fs.length) {
                        const f = new File([fs[0]], fs[0].webkitRelativePath?.split("/")[0] || "folder", { type: "application/zip" });
                        // We can't use JSZip on a directory, warn user
                        setError("Please use the .zip file instead of a folder — Instagram exports should come as a .zip");
                        setPhase("error");
                      }
                    }} />
                    Pick a folder
                  </label>
                </div>
              </div>
              <div className="ms-demo-row">
                <span className="ms-muted">no export handy?</span>
                <button className="ms-link" onClick={onLoadDemo}>load a sample archive →</button>
              </div>
            </>
          )}

          {(phase === "reading") && (
            <div className="ms-parse">
              <div className="ms-parse-head">
                <span className="ms-parse-spin" aria-hidden="true" />
                <div>
                  <div className="ms-parse-title">Reading {filename}</div>
                  <div className="ms-parse-sub">everything below happens in this tab</div>
                </div>
              </div>
              <div className="ms-parse-bar">
                <span className="ms-parse-bar-fill" style={{ width: progress + "%" }} />
              </div>
              <ul className="ms-parse-log">
                {readouts.map((r, i) => (
                  <li key={i}><span className="ms-parse-dot" />{r}</li>
                ))}
              </ul>
            </div>
          )}

          {phase === "done" && (
            <div className="ms-parse ms-parse-done">
              <div className="ms-parse-title">Ready. Opening your archive…</div>
            </div>
          )}

          {phase === "error" && (
            <div className="ms-parse">
              <div className="ms-parse-title">Could not read archive</div>
              <div className="ms-parse-error">{error}</div>
              <div style={{ marginTop: 16 }}>
                <button className="ms-btn" onClick={() => setPhase("idle")}>Try again</button>
              </div>
            </div>
          )}
        </div>
      </main>

      <section className="ms-how" id="how">
        <div className="ms-how-step">
          <span className="ms-how-num">i.</span>
          <h4>Request your data on instagram.com</h4>
          <p>Settings → Your activity → Download your information. Choose <em>messages</em> and <em>JSON</em> format.</p>
        </div>
        <div className="ms-how-step">
          <span className="ms-how-num">ii.</span>
          <h4>Drop the .zip into Messories</h4>
          <p>The archive never touches a server. Parsing happens here, in this browser tab.</p>
        </div>
        <div className="ms-how-step">
          <span className="ms-how-num">iii.</span>
          <h4>Wander your history</h4>
          <p>Read, search, see when you talked most. Your conversations, kept where they belong.</p>
        </div>
      </section>

      <footer className="ms-landing-foot">
        <span>Messories · est. {new Date().getFullYear()}</span>
        <span className="ms-foot-sep">·</span>
        <span>made because end-to-end deserved to stay</span>
      </footer>
    </div>
  );
}
