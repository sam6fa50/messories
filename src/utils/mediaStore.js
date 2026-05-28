let _zip = null;
const _cache = new Map();

export function setZip(zip) {
  _zip = zip;
  _cache.clear();
}

export function clearZip() {
  _zip = null;
  _cache.clear();
}

export function isZipReady() { return _zip !== null; }

export async function warmupZip(file) {
  if (_zip) return;
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(file);
    if (!_zip) setZip(zip);
  } catch {}
}

export async function resolveUri(uri) {
  if (!uri) return null;
  if (uri.startsWith("blob:") || uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  if (_cache.has(uri)) return _cache.get(uri);
  if (!_zip) return null;

  const normalized = uri.replace(/\\/g, "/").replace(/^\//, "");
  const file = _zip.file(normalized) || _zip.file("/" + normalized);
  if (!file) {
    _cache.set(uri, null);
    return null;
  }
  try {
    const blob = await file.async("blob");
    const url = URL.createObjectURL(blob);
    _cache.set(uri, url);
    return url;
  } catch {
    _cache.set(uri, null);
    return null;
  }
}
