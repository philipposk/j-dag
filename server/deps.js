// Production wiring. Credentials are only used when VERCEL_ENV === 'production'; previews and local runs get no store
// (the API answers 503) unless a test injects mocks.
import { createHash } from 'node:crypto';
const TIMEOUT = 5000;
export function makeStore(env, fetchFn = fetch) {
  if (env.VERCEL_ENV !== 'production' || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const rpc = async (fn, args) => {
    const r = await fetchFn(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', signal: AbortSignal.timeout(TIMEOUT),
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args) });
    if (!r.ok) throw new Error(`store ${fn} ${r.status}`);
    return r.status === 204 ? null : r.json();
  };
  return {
    listBars: n => rpc('jdag_list_bars', { p_limit: n }),
    rateHit: (kind, key, limit, windowS) => rpc('jdag_rate_hit', { p_kind: kind, p_key: key, p_limit: limit, p_window_s: windowS }).then(v => v === true),
    addBar: b => rpc('jdag_add_bar', { p_name: b.name, p_name_key: b.nameKey, p_address: b.address, p_source_url: b.source, p_lat: b.lat, p_lng: b.lng, p_osm_ref: b.osmRef, p_idem_key: b.idem, p_submitter_hash: b.who }),
    addReport: r => rpc('jdag_add_report', { p_bar_id: r.barId, p_reason: r.reason, p_note: r.note, p_reporter_hash: r.who }),
    markReportNotified: id => rpc('jdag_mark_report_notified', { p_report_id: id }),
    nominatimSlot: () => rpc('jdag_nominatim_slot', {}).then(v => v === true),
    geocacheGet: k => rpc('jdag_geocache_get', { p_key: k }),
    geocachePut: (k, v) => rpc('jdag_geocache_put', { p_key: k, p_result: v }),
  };
}
export const makeHashIp = env => env.JDAG_IP_SALT && env.JDAG_IP_SALT.length >= 16
  ? ip => createHash('sha256').update(`${env.JDAG_IP_SALT}|${ip}`).digest('hex') : null;

// Nominatim: cached, globally limited to 1 request/second via the store, identified per the usage policy.
export function makeGeocode(store, fetchFn = fetch) {
  return async address => {
    const key = address.toLowerCase().slice(0, 200);
    const cached = await store.geocacheGet(key);
    if (cached) return cached.found ? cached : null;
    if (!(await store.nominatimSlot())) return 'busy';
    const u = new URL('https://nominatim.openstreetmap.org/search');
    for (const [k, v] of Object.entries({ q: address, format: 'jsonv2', countrycodes: 'dk', viewbox: '12.45,55.73,12.65,55.60', bounded: '1', limit: '1' })) u.searchParams.set(k, v);
    const r = await fetchFn(u, { headers: { 'User-Agent': 'j-dag.6x7.gr community bars (dev@6x7.gr)', 'Accept-Language': 'da,en' }, signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) throw new Error('geocode');
    const [hit] = await r.json();
    const ref = hit && /^(node|way|relation)$/.test(hit.osm_type) && /^\d{1,15}$/.test(String(hit.osm_id)) ? `${hit.osm_type}/${hit.osm_id}` : null;
    const result = hit ? { found: true, lat: Number(hit.lat), lng: Number(hit.lon), osmRef: ref } : { found: false };
    await store.geocachePut(key, result);
    return result.found ? result : null;
  };
}
export function makeMailer(env, fetchFn = fetch) {
  if (env.VERCEL_ENV !== 'production' || !env.RESEND_API_KEY || !env.JDAG_MAIL_FROM) return null;
  return async ({ to, subject, text, idempotencyKey }) => {
    const r = await fetchFn('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(TIMEOUT),
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ from: env.JDAG_MAIL_FROM, to, subject, text }) });
    return { ok: r.ok };
  };
}
