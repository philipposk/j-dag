// Rules shared by the browser form and the server. The server re-checks everything.
export const LIMITS = { name: 120, address: 200, source: 500, note: 300 };
export const REASONS = ['closed', 'not_participating', 'wrong_place', 'spam', 'other'];
export const BBOX = { south: 55.60, north: 55.73, west: 12.45, east: 12.65 }; // Copenhagen area served by the map
export const cleanField = s => String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]+/g, ' ').replace(/\s+/g, ' ').trim();
export const foldName = s => cleanField(s).toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'aa').replace(/ß/g, 'ss')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const inBbox = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat >= BBOX.south && lat <= BBOX.north && lng >= BBOX.west && lng <= BBOX.east;

export function validateSuggestion(f) {
  const e = {};
  for (const k of ['name', 'address', 'source']) {
    const v = cleanField(f[k]);
    if (!v) { if (k !== 'source') e[k] = 'required'; continue; }
    if (v.length > LIMITS[k]) { e[k] = 'long'; continue; }
    if (k === 'source') { let u; try { u = new URL(v); } catch { e.source = 'url'; continue; }
      if (!/^https?:$/.test(u.protocol) || u.username || u.password || /[\s<>"]/.test(v)) e.source = 'url'; }
  }
  for (const k of ['name', 'address']) if (!e[k] && /[<>{}\\]/.test(cleanField(f[k]))) e[k] = 'chars';
  if (!e.name && !/[\p{L}\p{N}]/u.test(cleanField(f.name))) e.name = 'required';
  return e;
}
export function validateReport(r) {
  const e = {};
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(r.barId ?? ''))) e.barId = 'invalid';
  if (!REASONS.includes(r.reason)) e.reason = 'required';
  if (cleanField(r.note).length > LIMITS.note) e.note = 'long';
  return e;
}
