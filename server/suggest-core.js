// Server side of "Missing a bar?": validates a suggestion and emails it to the site owner for manual review.
// Nothing is stored and nothing is added to the map. Recipient, sender and subject are fixed here, never from the client.
import { validateSuggestion, cleanField } from '../src/suggest.js';
export const RECIPIENT = 'filippos@6x7.gr';
export const MAX_BODY = 4096;
const ORIGINS = ['https://j-dag.6x7.gr'];
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MIN_FILL_MS = 3000, MAX_FILL_MS = 6 * 3600_000;

// Per-instance limiter. On Vercel each instance has its own memory, so this slows abuse but is not a hard limit.
export function memoryLimiter() {
  const hits = new Map();
  return { hit(key, limit, windowMs, now) {
    const b = hits.get(key); if (!b || b.reset <= now) { hits.set(key, { n: 1, reset: now + windowMs }); return true; }
    if (b.n >= limit) return false; b.n++; return true; } };
}
const reply = (status, body) => ({ status, body });
const header = (h, k) => h?.[k] ?? h?.[k.toLowerCase()];

export async function handleSuggest(req, { env, now = Date.now, limiter, send }) {
  if (req.method !== 'POST') return reply(405, { error: 'method' });
  const origin = header(req.headers, 'origin');
  const allowed = ORIGINS.includes(origin) || (env.VERCEL_ENV !== 'production' && DEV_ORIGIN.test(origin ?? ''))
    || (env.VERCEL_ENV === 'preview' && env.VERCEL_URL && origin === `https://${env.VERCEL_URL}`);
  if (!allowed) return reply(403, { error: 'origin' });
  if (!/^application\/json\b/.test(header(req.headers, 'content-type') ?? '')) return reply(415, { error: 'type' });
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  if (raw.length > MAX_BODY) return reply(413, { error: 'size' });
  let p; try { p = JSON.parse(raw); } catch { return reply(400, { error: 'json' }); }
  if (!p || typeof p !== 'object') return reply(400, { error: 'json' });
  const t = now(), fields = { name: p.name, address: p.address, source: p.source };
  // Bots: hidden field filled, or submitted faster than a person could type. Pretend success, send nothing.
  if (p.website || !(t - Number(p.startedAt) >= MIN_FILL_MS && t - Number(p.startedAt) <= MAX_FILL_MS)) return reply(200, { ok: true });
  const errors = validateSuggestion(fields);
  if (Object.keys(errors).length) return reply(400, { error: 'fields', errors });
  if (!env.RESEND_API_KEY) return reply(503, { error: 'not-configured' });
  const ip = String(header(req.headers, 'x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!limiter.hit(`ip:${ip}`, 3, 10 * 60_000, t) || !limiter.hit('all', 30, 24 * 3600_000, t)) return reply(429, { error: 'rate' });
  const lang = p.lang === 'da' ? 'da' : 'en', name = cleanField(fields.name);
  const key = /^[A-Za-z0-9-]{1,64}$/.test(String(p.key ?? '')) ? `jdag-suggest-${p.key}` : undefined;
  const text = [`Someone suggested a bar for the J-dag map (not added automatically).`, '',
    `Bar: ${name}`, `Address: ${cleanField(fields.address)}`, `Source: ${cleanField(fields.source) || '(none)'}`, `Page language: ${lang}`, '',
    `Check it by hand before adding it to data/venues.json.`].join('\n');
  try {
    const r = await send({ to: [RECIPIENT], subject: `J-dag suggestion: ${name}`, text, idempotencyKey: key });
    return r?.ok ? reply(200, { ok: true }) : reply(502, { error: 'provider' });
  } catch { return reply(502, { error: 'provider' }); }
}

// Resend REST call. Sender comes from SUGGEST_FROM (must be on a Resend-verified domain).
export function resendSender(env) {
  return async ({ to, subject, text, idempotencyKey }) => {
    const res = await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: JSON.stringify({ from: env.SUGGEST_FROM || 'J-dag <hello@6x7.gr>', to, subject, text }) });
    return { ok: res.ok };
  };
}
