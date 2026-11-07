# Missing-bar suggestion (approved design, 2026-11-07)

User approved: "Build the missing-bar form that opens a prepared email, with a copy-text fallback."

## Spec
- Collapsed `<details>` "Missing a bar?" / "Mangler der en bar?" right after the full bar list. EN/DA.
- Fields (visible labels): bar name (required, ≤120), address (required, ≤200), source link (optional, http/https only, ≤500).
- "Open email" builds `mailto:filippos@6x7.gr` with subject + body only. Recipient is a constant; input is
  URL-encoded into `subject`/`body`, so it can never add recipients or headers. Body holds the fields, page language
  and roster year. Never the visitor's location or searches. Nothing is sent and no request is made.
- "Copy text" uses the clipboard if allowed; otherwise (or on error) shows the prepared text in a visible, selected
  read-only textarea. Status text only claims what actually happened.
- Disclosure: opens your email app, you send it there; checked by hand before anything changes on the map; no reply promised.
- Errors: inline per field (`aria-invalid`, `aria-describedby`), focus moves to the first invalid field; status is `role="status"`.
- Typed values survive language switches (labels are relabelled, inputs untouched). Roster data and SEO pages are unchanged.

## Plan
1. `test/suggest.test.js`: validation, encoding (æøå), fixed recipient / no header injection, body content, copy fallback.
2. `src/suggest.js`: pure `validateSuggestion`, `buildEmail`, `copyText`; `mountSuggest` DOM wiring.
3. Mount in `src/main.js`, relabel in `renderLanguage`, small CSS, README.
4. Build, unit tests, Playwright desktop/mobile smoke under production CSP.
