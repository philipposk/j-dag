import { handleSuggest, memoryLimiter, resendSender } from '../server/suggest-core.js';
const limiter = memoryLimiter();
export const config = { maxDuration: 10 };
export default async function handler(req, res) {
  let body = '';
  if (typeof req.body === 'string') body = req.body;
  else if (req.body && typeof req.body === 'object') body = JSON.stringify(req.body);
  const r = await handleSuggest({ method: req.method, headers: req.headers, body }, { env: process.env, limiter, send: resendSender(process.env) });
  res.setHeader('Cache-Control', 'no-store');
  res.status(r.status).json(r.body);
}
