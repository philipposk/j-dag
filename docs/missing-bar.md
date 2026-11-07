# Community-added bars (approved t29 + t30, 2026-11-07)

Supersedes the mailto and email-only designs. Status: design + draft migration; nothing applied to Supabase/Vercel yet.

## Behaviour
- "Missing a bar?" form (EN/DA): bar name (req, ≤120), address (req, ≤200), source link (opt, http/https, ≤500). No visitor
  email, no GPS/search text sent. Hidden honeypot + min fill time.
- Server (`/api/community-bars`, Vercel function) geocodes the address itself (Nominatim, Copenhagen bbox, 1 req/s),
  rejects out-of-area or unresolvable addresses (hold → "couldn't check that address"), dedupes against the official
  list and existing community entries (accent/case-folded name + ≤75 m, or same OSM id), then inserts. The client never
  sends coordinates.
- Accepted entries show immediately as **Community-added · unverified** pins (distinct colour, legend) and in a separate
  list with "Report". Copy: "Added by visitors. Not checked: we don't know if it takes part, is open or is accessible."
- Official list, count (132, 2026), Anker caveat, SEO pages unchanged; nearest-bar uses official bars by default with an
  opt-in "include community bars" checkbox.
- Report: reason (closed / not taking part / wrong place / spam / other) + optional note ≤300. Stored privately; one
  report never deletes. An entry is auto-hidden only at ≥3 distinct-reporter reports (hashed IP+day salt); owner can
  restore/remove. Duplicate reports from the same reporter are ignored.
- Notifications (fixed recipients in code, no client control): new bar → filippos@6x7.gr; new unique report →
  dev@6x7.gr with bar, reason, note, link (no IP). Global cap 20 mails/day; the row is stored first and an email failure
  only sets `notified_at = null` (never claimed delivered).
- Owner moderation: SQL/Supabase dashboard (service role) only; no public admin endpoint in this PR.

## Abuse limits (distributed, in Postgres)
- Per hashed IP: 3 submissions/10 min, 10/day; 10 reports/day. Global: 50 submissions/day. Body ≤4 KB, Origin allowlist,
  idempotency key unique per submission.

## Resources (existing only)
- Supabase project `6x7` (fmrnqepyyjucnfbrqawl, eu-central-1), new schema `jdag` (tables + SECURITY DEFINER RPCs), RLS on,
  anon may only `select` from view `jdag.public_bars` (sanitized fields). See `supabase/jdag-community.sql`.
- Vercel project `j-dag` env (none today): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (6x7 project), RESEND_API_KEY (same
  Resend account as 6x7.gr; 6x7.gr has a Resend DKIM record), JDAG_MAIL_FROM (e.g. `J-dag <hello@6x7.gr>`), JDAG_IP_SALT.
