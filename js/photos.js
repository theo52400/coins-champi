// Photos : prise de vue, compression (sans métadonnées), vignette, et lecture du GPS EXIF des photos de la galerie.

export function pickImage(opts) {
  const o = Object.assign({ capture: true }, opts || {});
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    if (o.capture) inp.setAttribute('capture', 'environment');
    inp.style.position = 'fixed'; inp.style.left = '-1000px';
    let done = false;
    const finish = f => { if (done) return; done = true; inp.remove(); resolve(f || null); };
    inp.addEventListener('change', () => finish(inp.files && inp.files[0]));
    inp.addEventListener('cancel', () => finish(null));
    document.body.appendChild(inp);
    inp.click();
  });
}

async function decode(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* repli */ }
  }
  return new Promise((res, rej) => { const url = URL.createObjectURL(file); const im = new Image(); im.onload = () => { URL.revokeObjectURL(url); res(im); }; im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Image illisible')); }; im.src = url; });
}
function encode(img, maxDim, maxChars, q0) {
  const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight;
  let scale = Math.min(1, maxDim / Math.max(w0, h0)), q = q0, url = '';
  for (let pass = 0; pass < 8; pass++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w0 * scale)); c.height = Math.max(1, Math.round(h0 * scale));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    url = c.toDataURL('image/jpeg', q);
    if (url.length <= maxChars) break;
    if (q > 0.5) q -= 0.1; else scale *= 0.8;
  }
  return url;
}
// Photo complète (≤ ~650 Ko en base64, tient dans un document Firestore) + vignette carrée
export async function processPhoto(file) {
  const img = await decode(file);
  const full = encode(img, 1400, 650000, 0.78);
  const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight, side = Math.min(w, h);
  const c = document.createElement('canvas'); c.width = c.height = 220;
  c.getContext('2d').drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 220, 220);
  const thumb = c.toDataURL('image/jpeg', 0.7);
  let gps = null;
  try { gps = exifGps(await file.slice(0, 256 * 1024).arrayBuffer()); } catch (e) { gps = null; }
  if (img.close) img.close();
  return { full, thumb, gps };
}

// Lecture minimale du bloc EXIF GPS d'un JPEG
export function exifGps(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
  let off = 2;
  while (off + 4 < v.byteLength) {
    const marker = v.getUint16(off), size = v.getUint16(off + 2);
    if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10);
    if ((marker & 0xFF00) !== 0xFF00 || size < 2) break;
    off += 2 + size;
  }
  return null;
}
function parseTiff(v, t) {
  const le = v.getUint16(t) === 0x4949;
  const u16 = o => v.getUint16(t + o, le), u32 = o => v.getUint32(t + o, le);
  const ifd0 = u32(4), n0 = u16(ifd0);
  let gpsOff = 0;
  for (let i = 0; i < n0; i++) { const e = ifd0 + 2 + i * 12; if (u16(e) === 0x8825) gpsOff = u32(e + 8); }
  if (!gpsOff) return null;
  const n = u16(gpsOff), tags = {};
  for (let i = 0; i < n; i++) {
    const e = gpsOff + 2 + i * 12, tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
    if (type === 2) tags[tag] = String.fromCharCode(v.getUint8(t + e + 8));
    else if (type === 5 && cnt === 3) { const o = u32(e + 8), r = k => u32(o + k * 8) / (u32(o + k * 8 + 4) || 1); tags[tag] = r(0) + r(1) / 60 + r(2) / 3600; }
  }
  if (tags[2] == null || tags[4] == null) return null;
  const lat = tags[2] * (tags[1] === 'S' ? -1 : 1), lng = tags[4] * (tags[3] === 'W' ? -1 : 1);
  return isFinite(lat) && isFinite(lng) && (lat || lng) ? { lat, lng } : null;
}
