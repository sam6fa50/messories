const DB_NAME = "messories-parsed-v1";
let _db = null;

function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      db.createObjectStore("meta");
      db.createObjectStore("msgs");
    };
    req.onsuccess = (e) => { _db = e.target.result; res(_db); };
    req.onerror = (e) => rej(e.target.error);
  });
}

function idbGet(db, store, key) {
  return new Promise((res) => {
    const req = db.transaction(store, "readonly").objectStore(store).get(key);
    req.onsuccess = (e) => res(e.target.result ?? null);
    req.onerror = () => res(null);
  });
}

function idbPut(db, store, key, val) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(val, key);
    tx.oncomplete = res;
    tx.onerror = (e) => rej(e.target.error);
  });
}

export function archiveKey(name, size) {
  return `${name}:${size}`;
}

export async function getCachedMeta(key) {
  try { const db = await openDb(); return await idbGet(db, "meta", key); }
  catch { return null; }
}

export async function saveMeta(key, val) {
  try { const db = await openDb(); await idbPut(db, "meta", key, val); }
  catch {}
}

export async function getCachedMessages(key, threadId) {
  try { const db = await openDb(); return await idbGet(db, "msgs", `${key}:${threadId}`); }
  catch { return null; }
}

export async function saveMessages(key, threadId, msgs) {
  try { const db = await openDb(); await idbPut(db, "msgs", `${key}:${threadId}`, msgs); }
  catch {}
}

export async function clearParsed() {
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const tx = db.transaction(["meta", "msgs"], "readwrite");
      tx.objectStore("meta").clear();
      tx.objectStore("msgs").clear();
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch {}
}
