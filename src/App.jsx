import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Landing from "./components/Landing.jsx";
import ThreadList from "./components/ThreadList.jsx";
import ThreadView from "./components/ThreadView.jsx";
import InsightsPanel from "./components/InsightsPanel.jsx";
import SearchOverlay from "./components/SearchOverlay.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import { SAMPLE_THREADS, SAMPLE_PROFILE } from "./data/sampleData.js";
import { getCachedMessages } from "./utils/db.js";

const PALETTES = {
  sepia:       { name: "Sepia Album",   bg: "#f5efe6", panel: "#f0e8db", ink: "#2a2722", inkMuted: "#7a6f60", accent: "#b8836b", soft: "#d4b896", bubbleTheirs: "#ece1ce", bubbleMine: "#2a2722", bubbleMineInk: "#f5efe6", line: "#d8c9b1", placeholderBg: "#e8dcc6", placeholderFg: "#b8836b" },
  letterpress: { name: "Letterpress",   bg: "#f0ebe1", panel: "#e8dfcf", ink: "#3a2a1f", inkMuted: "#85715f", accent: "#a64b2a", soft: "#e6d3b8", bubbleTheirs: "#e3d6bf", bubbleMine: "#3a2a1f", bubbleMineInk: "#f0ebe1", line: "#d1bfa3", placeholderBg: "#e6d3b8", placeholderFg: "#a64b2a" },
  moonlight:   { name: "Moonlight",     bg: "#161217", panel: "#1d1820", ink: "#ede4d3", inkMuted: "#9b8e7a", accent: "#c9a86b", soft: "#6b7a99", bubbleTheirs: "#27212a", bubbleMine: "#c9a86b", bubbleMineInk: "#1d1820", line: "#2a2430", placeholderBg: "#2c2530", placeholderFg: "#c9a86b" },
  sage:        { name: "Pressed Sage",  bg: "#f5f3ec", panel: "#ece9df", ink: "#1f2422", inkMuted: "#6f7670", accent: "#5c6b5a", soft: "#b4a89a", bubbleTheirs: "#e1ddd0", bubbleMine: "#1f2422", bubbleMineInk: "#f5f3ec", line: "#cfc9b6", placeholderBg: "#dcd6c4", placeholderFg: "#5c6b5a" },
  dusk:        { name: "Dusk",          bg: "#f8eff0", panel: "#f0e4e6", ink: "#2e1820", inkMuted: "#8a5f6a", accent: "#c0607a", soft: "#e4b0bb", bubbleTheirs: "#f0dde0", bubbleMine: "#2e1820", bubbleMineInk: "#f8eff0", line: "#dfc0c6", placeholderBg: "#e8d4d8", placeholderFg: "#c0607a" },
  blueprint:   { name: "Blueprint",     bg: "#0f1a2e", panel: "#162133", ink: "#ccdff0", inkMuted: "#5880a4", accent: "#4a9de0", soft: "#243d5c", bubbleTheirs: "#1c2d44", bubbleMine: "#4a9de0", bubbleMineInk: "#0f1a2e", line: "#243550", placeholderBg: "#1a2d46", placeholderFg: "#4a9de0" },
  chalk:       { name: "Chalk",         bg: "#fafaf8", panel: "#f4f4f0", ink: "#181818", inkMuted: "#686860", accent: "#3a6040", soft: "#b8c8b4", bubbleTheirs: "#eeeeea", bubbleMine: "#181818", bubbleMineInk: "#fafaf8", line: "#dcdcd4", placeholderBg: "#e8e8e2", placeholderFg: "#3a6040" },
  ember:       { name: "Ember",         bg: "#130c08", panel: "#1c1208", ink: "#f0dcc4", inkMuted: "#907050", accent: "#e07020", soft: "#3c2010", bubbleTheirs: "#251408", bubbleMine: "#e07020", bubbleMineInk: "#130c08", line: "#30180c", placeholderBg: "#2c1c0c", placeholderFg: "#e07020" },
  aurora:      { name: "Aurora",        bg: "#07101c", panel: "#0c1824", ink: "#c8e4e0", inkMuted: "#4a8078", accent: "#38c4a0", soft: "#163c38", bubbleTheirs: "#0f1e28", bubbleMine: "#38c4a0", bubbleMineInk: "#07101c", line: "#16303a", placeholderBg: "#0e2030", placeholderFg: "#38c4a0" },
};

const DEFAULTS = { palette: "sepia", density: "regular", fontSize: 16, bubbleMax: 480, bubbleShape: "soft", typeVoice: "journal", msgFont: "serif", chatBg: "none", displayName: "" };

export default function App() {
  const [screen, setScreen] = useState("landing");
  const [threads, setThreads] = useState(SAMPLE_THREADS);
  const [profile, setProfile] = useState(SAMPLE_PROFILE);
  const [activeId, setActiveId] = useState(SAMPLE_THREADS[0]?.id);
  const [archKey, setArchKey] = useState(null);
  const [activeMessages, setActiveMessages] = useState(SAMPLE_THREADS[0]?.messages ?? null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [mobileShowList, setMobileShowList] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingJump, setPendingJump] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tweaks, setTweaks] = useState(() => {
    try {
      const saved = localStorage.getItem("ms-tweaks");
      if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULTS;
  });
  const msgCache = useRef(new Map()); // threadId → messages[], cleared on archive change

  const palette = PALETTES[tweaks.palette] || PALETTES.sepia;

  // Persist tweaks
  useEffect(() => {
    try { localStorage.setItem("ms-tweaks", JSON.stringify(tweaks)); } catch {}
  }, [tweaks]);

  // Resolved profile with display name override
  const resolvedProfile = useMemo(() => {
    if (!profile) return profile;
    const name = tweaks.displayName?.trim() || profile.displayName;
    return { ...profile, displayName: name };
  }, [profile, tweaks.displayName]);

  // Apply CSS vars
  useEffect(() => {
    const r = document.documentElement;
    Object.entries(palette).forEach(([k, v]) => {
      if (typeof v === "string" && v.startsWith("#")) r.style.setProperty(`--p-${k}`, v);
    });
    r.style.setProperty("--ms-font-size", tweaks.fontSize + "px");
    r.style.setProperty("--ms-bubble-max", tweaks.bubbleMax + "px");
    r.dataset.palette = tweaks.palette;
    r.dataset.density = tweaks.density;
    r.dataset.bubbleShape = tweaks.bubbleShape;
    r.dataset.typeVoice = tweaks.typeVoice;
    r.dataset.msgFont = tweaks.msgFont;
    r.dataset.chatbg = tweaks.chatBg;
  }, [palette, tweaks]);

  const [vw, setVw] = useState(window.innerWidth);
  useEffect(() => {
    const fn = () => setVw(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const narrow = vw < 720;

  // Keyboard shortcuts
  useEffect(() => {
    if (screen !== "app") return;
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const tag = document.activeElement?.tagName || "";
      const inField = tag === "INPUT" || tag === "TEXTAREA";
      if (mod && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "/" && !inField) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  const handleJumpToMessage = useCallback((threadId, msgId) => {
    setActiveId(threadId);
    setMobileShowList(false);
    setInsightsOpen(false);
    setPendingJump({ threadId, msgId, ts: Date.now() });
  }, []);

  const handleDataLoaded = useCallback((newThreads, newProfile, newArchKey) => {
    setThreads(newThreads);
    setProfile(newProfile);
    setArchKey(newArchKey || null);
    setActiveMessages(null);
    setActiveId(newThreads[0]?.id);
    setScreen("app");
  }, []);

  // Clear message cache when the loaded archive changes
  useEffect(() => { msgCache.current.clear(); }, [archKey]);

  // Load messages for the active thread on demand
  useEffect(() => {
    if (!activeId) return;
    if (!archKey) {
      const t = threads.find((t) => t.id === activeId);
      setActiveMessages(t?.messages ?? []);
      return;
    }
    // Serve from in-memory cache — no IDB round-trip, no loading flash
    if (msgCache.current.has(activeId)) {
      setActiveMessages(msgCache.current.get(activeId));
      return;
    }
    setActiveMessages(null); // first visit: show loading spinner while IDB loads
    getCachedMessages(archKey, activeId).then((msgs) => {
      const result = msgs || [];
      msgCache.current.set(activeId, result);
      setActiveMessages(result);
    });
  }, [activeId, archKey, threads]);

  const activeThreadStub = threads.find((t) => t.id === activeId) || threads[0];
  const activeThread = useMemo(() => {
    if (!activeThreadStub) return null;
    return { ...activeThreadStub, messages: activeMessages ?? [] };
  }, [activeThreadStub, activeMessages]);

  if (screen === "landing") {
    return (
      <Landing
        onLoadDemo={() => {
          setThreads(SAMPLE_THREADS);
          setProfile(SAMPLE_PROFILE);
          setActiveId(SAMPLE_THREADS[0]?.id);
          setScreen("app");
        }}
        onDataLoaded={handleDataLoaded}
      />
    );
  }

  const showList = !narrow || mobileShowList;
  const showThread = !narrow || !mobileShowList;

  return (
    <div
      className={`ms-app ${narrow ? "ms-narrow" : ""} ${insightsOpen ? "ms-insights-open" : ""} ${settingsOpen ? "ms-settings-open" : ""}`}
      data-density={tweaks.density}
    >
      {showList && (
        <ThreadList
          threads={threads}
          activeId={activeId}
          onSelect={(id) => { setActiveId(id); if (narrow) setMobileShowList(false); }}
          onBackToImport={() => setScreen("landing")}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {showThread && activeThread && (
        <ThreadView
          thread={activeThread}
          palette={palette}
          density={tweaks.density}
          insightsOpen={insightsOpen}
          onToggleInsights={() => setInsightsOpen((v) => !v)}
          onBack={() => setMobileShowList(true)}
          narrow={narrow}
          profile={resolvedProfile}
          pendingJump={pendingJump}
          onJumpHandled={() => setPendingJump(null)}
          onOpenSearch={() => setSearchOpen(true)}
          messagesLoading={archKey !== null && activeMessages === null}
        />
      )}

      {activeThread && (
        <InsightsPanel
          thread={activeThread}
          palette={palette}
          onClose={() => setInsightsOpen(false)}
          open={insightsOpen}
          profile={resolvedProfile}
          onJumpToMessage={(mid) => {
            setInsightsOpen(false);
            setPendingJump({ threadId: activeThread.id, msgId: mid, ts: Date.now() });
          }}
        />
      )}

      <SearchOverlay
        threads={threads}
        archKey={archKey}
        activeMessages={activeMessages}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onJump={handleJumpToMessage}
        profile={resolvedProfile}
        activeThreadId={activeThread?.id}
        activeThreadTitle={activeThread?.title}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        tweaks={tweaks}
        onChange={setTweaks}
        palettes={PALETTES}
        profile={resolvedProfile}
      />
    </div>
  );
}

