// Server for community-added bars: list, add (server-side geocode + dedupe), report (stored; owner notified).
// Fails closed: without a working store or salt it answers 503 and writes nothing.
import { cleanField, foldName, inBbox, validateSuggestion, validateReport } from '../src/community-shared.js';
import { distanceMeters } from '../src/geo.js';
export const REPORT_RECIPIENT = 'dev@6x7.gr';
export const MAX_BODY = 4096;
export const SITE = 'https://j-dag.6x7.gr';
const ORIGINS = [SITE];
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MIN_FILL_MS = 3000, MAX_FILL_MS = 6 * 3600_000, MAIL_PER_DAY = 20;
const reply = (status, body, headers = {}) => ({ status, body, headers: { 'Cache-Control': 'no-store', ...headers } });
const hdr = (h, k) => h?.[k] ?? h?.[k.toLowerCase()];

export function isOfficialDuplicate(name, point, official) {
  const key = foldName(name);
  return official.find(v => { const k = foldName(v.name);
    if (k === key) return true;
    const near = point && Number.isFinite(v.lat) && distanceMeters(point, v) < 300;
    return near && key.length >= 4 && k.length >= 4 && (k.includes(key) || key.includes(k)); }) ?? null;
}

export async function handleCommunity(req, d) {
  const { env, now = Date.now, store, hashIp } = d;
  if (req.method === 'GET') {
    if (!store) return reply(503, { error: 'unavailable' });
    try { const bars = await store.listBars(500);
      return reply(200, { bars: bars.map(b => ({ id: b.id, name: b.name, address: b.address, sourceUrl: b.source_url ?? null, lat: b.lat, lng: b.lng, createdAt: b.created_at })) },
        { 'Cache-Control': 'public, max-age=0, s-maxage=30' });
    } catch { return reply(503, { error: 'unavailable' }); }
  }
  if (req.method !== 'POST') return reply(405, { error: 'method' }, { Allow: 'GET, POST' });
  const origin = hdr(req.headers, 'origin');
  const ok = ORIGINS.includes(origin) || (env.VERCEL_ENV !== 'production' && DEV_ORIGIN.test(origin ?? ''));
  if (!ok) return reply(403, { error: 'origin' });
  if (!/^application\/json\b/.test(hdr(req.headers, 'content-type') ?? '')) return reply(415, { error: 'type' });
  const raw = req.body ?? '';
  if (typeof raw !== 'string' || raw.length > MAX_BODY) return reply(413, { error: 'size' });
  let p; try { p = JSON.parse(raw); } catch { return reply(400, { error: 'json' }); }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return reply(400, { error: 'json' });
  const t = now();
  // Bots: hidden field filled, or faster than a person types. Answer like a normal hold, store nothing.
  if (p.website || !(t - Number(p.startedAt) >= MIN_FILL_MS && t - Number(p.startedAt) <= MAX_FILL_MS)) return reply(202, { status: 'received' });
  if (!store || !hashIp) return reply(503, { error: 'unavailable' });
  const ip = String(hdr(req.headers, 'x-real-ip') ?? hdr(req.headers, 'x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const who = hashIp(ip);
  try {
    if (p.action === 'add') return await addBar(p, who, d);
    if (p.action === 'report') return await addReport(p, who, d);
    return reply(400, { error: 'action' });
  } catch { return reply(503, { error: 'unavailable' }); }
}

async function addBar(p, who, { store, geocode, official }) {
  const f = { name: p.name, address: p.address, source: p.source };
  const errors = validateSuggestion(f);
  if (Object.keys(errors).length) return reply(400, { error: 'fields', errors });
  const name = cleanField(f.name), address = cleanField(f.address), source = cleanField(f.source);
  const idem = /^[A-Za-z0-9-]{8,64}$/.test(String(p.key ?? '')) ? String(p.key) : null;
  if (!idem) return reply(400, { error: 'key' });
  if (!(await store.rateHit('add', who, 3, 600)) || !(await store.rateHit('add-day', who, 10, 86400)) || !(await store.rateHit('add-all', 'global', 50, 86400)))
    return reply(429, { error: 'rate' });
  const pre = isOfficialDuplicate(name, null, official);
  if (pre) return reply(409, { status: 'official', name: pre.name });
  const g = await geocode(address);
  if (g === 'busy') return reply(503, { error: 'busy' });
  if (!g) return reply(422, { status: 'address' });
  if (!inBbox(g.lat, g.lng)) return reply(422, { status: 'area' });
  const near = isOfficialDuplicate(name, g, official);
  if (near) return reply(409, { status: 'official', name: near.name });
  const r = await store.addBar({ name, nameKey: foldName(name).slice(0, 120), address, source, lat: g.lat, lng: g.lng, osmRef: g.osmRef ?? null, idem, who });
  if (r.status === 'duplicate') return reply(409, { status: 'duplicate', name: r.name });
  if (r.status === 'full') return reply(503, { error: 'full' });
  return reply(201, { status: 'added', bar: { id: r.id, name, address, sourceUrl: source || null, lat: g.lat, lng: g.lng } });
}

async function addReport(p, who, { store, mailer }) {
  const r = { barId: p.barId, reason: p.reason, note: p.note };
  const errors = validateReport(r);
  if (Object.keys(errors).length) return reply(400, { error: 'fields', errors });
  if (!(await store.rateHit('report', who, 10, 86400)) || !(await store.rateHit('report-all', 'global', 200, 86400))) return reply(429, { error: 'rate' });
  const res = await store.addReport({ barId: r.barId, reason: r.reason, note: cleanField(r.note), who });
  if (res.status === 'missing') return reply(404, { status: 'missing' });
  if (res.status === 'duplicate') return reply(200, { status: 'already' });
  // Stored. Notify the owner only within the daily mail budget; a failed email leaves notified_at empty.
  if (mailer) {
    try {
      if (await store.rateHit('mail', 'global', MAIL_PER_DAY, 86400)) {
        const sent = await mailer({ to: [REPORT_RECIPIENT], subject: `J-dag report: ${res.bar_name}`.slice(0, 150),
          idempotencyKey: `jdag-report-${res.report_id}`,
          text: [`A visitor reported a community-added bar (nothing was hidden automatically).`, '',
            `Bar: ${res.bar_name}`, `Address: ${res.bar_address}`, `Reason: ${r.reason}`, `Note: ${cleanField(r.note) || '(none)'}`,
            `Bar id: ${r.barId}`, `Map: ${SITE}/`, '', `Hide or restore it in Supabase (see docs/missing-bar.md).`].join('\n') });
        if (sent?.ok) await store.markReportNotified(res.report_id);
      }
    } catch { /* report is already stored; notification stays pending */ }
  }
  return reply(200, { status: 'reported' });
}
