# Scoped review evidence — community-added bars (PR #6), 2026-11-07

Not a full audit. Guidance read: shared publishing gate skill; Shipyard `skills/review/SKILL.md` + `references/lessons.md`
(general app: own tests/build instead of verify.mjs); launch `seo-performance.md`, `search-console.md` earlier.

| Check | Status | Evidence |
|---|---|---|
| Unit + handler tests | PASS (local) | `npm test` (PGlite runs the real migration; mocks for Nominatim/Resend) |
| Migration grants/RLS/invoker/search_path | PASS (PGlite) | `test/sql.test.js`; PGlite stubs pg_cron and Supabase roles, so not proof on real Supabase |
| Many-identity exhaustion bounded | PASS (local) | 60 IPs → 50 rows; 200 IPs after budget → 0 new rows |
| List 1000 / full at 1001 | PASS (PGlite) | `test/sql.test.js` |
| Same-name entries select by UUID | PASS (browser mock) | `test/e2e/community-smoke.cjs` |
| Vercel bundling (JSON import, Node 22, streamed body) | PASS (offline `vercel build`, local harness) | preview/no-creds → 503, 10 KB → 413, bad origin → 403, PUT → 405 |
| Desktop/mobile smoke under production CSP | PASS (mocked API) | no console errors, no dialogs, tiles load |
| Official list 132 / Anker caveat / SEO raw HTML | PASS (local build) | unchanged static pages |
| llms.txt / README / privacy text updated | PASS | EN/DA privacy section, llms line |
| Real Supabase apply + advisors | PENDING | needs approval |
| Production env + real Nominatim/Resend | PENDING | needs approval; Resend key is send-only, so domain/quota unverified |
| dev@6x7.gr receives mail | PENDING | ImprovMX alias unchecked |
