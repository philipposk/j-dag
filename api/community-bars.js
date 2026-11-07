import official from '../data/venues.json' with { type: 'json' };
import { handleCommunity, MAX_BODY } from '../server/community.js';
import { makeStore, makeHashIp, makeGeocode, makeMailer } from '../server/deps.js';
// Reads the raw stream itself (req.body is never touched) so the size limit and JSON parsing are ours.
export const config = { maxDuration: 15 };
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) return null; chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}
export default async function handler(req, res) {
  const env = process.env, store = makeStore(env);
  const body = req.method === 'POST' ? await readBody(req) : '';
  const r = await handleCommunity({ method: req.method, headers: req.headers, body: body === null ? 'x'.repeat(MAX_BODY + 1) : body },
    { env, store, hashIp: makeHashIp(env), geocode: store && makeGeocode(store), mailer: makeMailer(env), official });
  for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  res.status(r.status).json(r.body);
}
