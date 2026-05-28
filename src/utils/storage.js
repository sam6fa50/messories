const DB_NAME = "messories-v1";
const STORE = "archive";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function saveArchive(file) {
  try {
    const db = await openDb();
    const buf = await file.arrayBuffer();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(
        { buf, name: file.name, size: file.size, savedAt: Date.now() },
        "zip"
      );
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function loadSavedMeta() {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get("zip");
      req.onsuccess = (e) => {
        const d = e.target.result;
        resolve(d ? { name: d.name, size: d.size, savedAt: d.savedAt } : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function loadArchiveFile() {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get("zip");
      req.onsuccess = (e) => {
        const d = e.target.result;
        if (!d) return resolve(null);
        resolve(new File([d.buf], d.name, { type: "application/zip" }));
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearArchive() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch {}
}

export function fmtBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fmtAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
