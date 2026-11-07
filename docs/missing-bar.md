# Community-added bars (approved t29 + t30, corrected by parent review, 2026-11-07)

Supersedes the mailto and email-only designs (PR #6 history).

## Behaviour
- Section "Community-added · unverified" / "Tilføjet af besøgende · ikke bekræftet" after the official full list:
  count, legend swatch, unverified note, list (name, address, optional source link `rel="nofollow ugc"`), "Show on map",
  "Report". Distinct dashed purple pins. Official list, 132 count, Anker caveat, SEO pages unchanged.
- "Closest" uses official bars only; a checkbox opts community bars in (shown with the unverified tag).
- "Missing a bar?" form: name (≤120), address (≤200), optional http(s) link (≤500). No visitor email or location.
  Hidden honeypot; the client waits until 3.2 s after opening so the server's 3 s trap never hits a real person.
- Server (`api/community-bars.js` → `server/community.js`) re-validates, rate-limits, rejects names on the official list
  (folded case/accents/Danish letters; partial names within 300 m), geocodes the address itself with Nominatim
  (bounded to the Copenhagen box, `countrycodes=dk`), rejects not-found/outside, then calls `jdag_add_bar`, which
  under an advisory lock dedupes by idempotency key, same OSM element, or same folded name within 150 m.
  Client coordinates are never read.
- Copy says plainly: the address lookup does not confirm the bar exists, takes part, is open or is accessible.
- Reports: reason (closed / not taking part / wrong place / spam / other) + note ≤300. Stored privately, one per
  reporter per bar. Nothing is hidden automatically. Each new unique report emails **dev@6x7.gr** (fixed) with bar,
  address, reason, note, id, map link — never IP or hash. Max 20 emails/day (Postgres counter). The report is stored
  first; `notified_at` is set only after Resend accepts the send. New bars send no email.

## Security
- Tables in private schema `jdag` (not exposed to the Data API; no anon/authenticated grants; RLS on, no policies).
- Server calls `public.jdag_*` RPCs: SECURITY INVOKER, `search_path = ''`, EXECUTE revoked from public/anon/authenticated,
  granted to service_role only. Tested against the real migration in PGlite (`test/sql.test.js`).
- Service-role key, Resend key and salt are used only when `VERCEL_ENV === 'production'`. Previews/local answer 503
  (fail closed) and write nothing.
- Raw IPs are never stored. A salted hash `sha256(JDAG_IP_SALT | ip)` (pseudonymous, not anonymous) is kept only in
  `rate_events` (deleted after 2 days) and on `reports` for duplicate-report prevention (reports deleted after 30 days).
  Community bars store no submitter identifier. Geocode cache (addresses only) is deleted after 30 days. All by
  `public.jdag_cleanup()` via pg_cron job `jdag-cleanup` (daily 03:17 UTC).
- Admission is one atomic call, `jdag_admit`: the global budget is checked first and a rejected attempt writes nothing,
  so rows per kind are bounded by the global limit per day however many IPs try.
- Limits: per IP 3 adds/10 min, 10/day, 10 reports/day; global 50 adds/day, 200 reports/day, 1000 visible bars
  (GET returns all of them, up to that same cap);
  Nominatim 1 request/s globally (`jdag_nominatim_slot`) + 30-day cache; body ≤4 KB; Origin must be
  https://j-dag.6x7.gr in production; JSON only.
- All visitor text is rendered with `textContent`; source links only http(s), `rel="nofollow ugc noopener noreferrer"`.
- Community bars are addressed by UUID everywhere in the UI (cards, pins, selection), so two entries with the same name
  in different places never get mixed up.

## Privacy (shown in EN/DA under "Privacy for additions and reports")
Public: bar name, address, link. Sent to Nominatim: the address. Private: reports (reason, note), kept ≤30 days,
emailed to dev@6x7.gr via Resend. Salted IP hash: ≤2 days for rate limits, ≤30 days with a report. Not collected:
IP itself, GPS/location, email, accounts. Storage: Supabase (EU, eu-central-1); hosting: Vercel.

## Owner moderation (no web admin)
In Supabase → SQL editor (project 6x7):
```sql
select id, name, address, source_url, status, created_at from jdag.community_bars order by created_at desc;
select r.created_at, b.name, r.reason, r.note from jdag.reports r join jdag.community_bars b on b.id = r.bar_id order by r.created_at desc;
update jdag.community_bars set status = 'hidden'  where id = '<uuid>';   -- hide
update jdag.community_bars set status = 'visible' where id = '<uuid>';   -- restore
update jdag.community_bars set status = 'removed' where id = '<uuid>';   -- remove for good (kept for dedupe/audit)
select * from jdag.reports where notified_at is null;                    -- reports whose email did not go out
```
Promoting a bar to the official list stays a manual edit of `data/venues.json` with a real source.

## Deployment (needs approval; nothing applied yet)
1. Apply `supabase/jdag-community.sql` to project `6x7` (fmrnqepyyjucnfbrqawl); run Supabase security advisors after.
2. Vercel project `j-dag`, **Production only**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (6x7 project), `RESEND_API_KEY`
   (default key; restricted to sending), `JDAG_MAIL_FROM` (e.g. `J-dag <hello@6x7.gr>`), `JDAG_IP_SALT` (random ≥32 chars).
3. Redeploy; check GET `/api/community-bars` = 200 `{bars:[]}`; one owner-approved real report test to dev@6x7.gr.
