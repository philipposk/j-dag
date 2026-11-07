# J-dag · Copenhagen closest-bar finder

Public: https://j-dag.6x7.gr

A small, bilingual, mobile-first Leaflet + OpenStreetMap page. Browser GPS stays on the device; a submitted address is sent to Nominatim (no autocomplete). No login, analytics, email signup or application notification system. The external map/geocoder providers still receive network requests. Directions open Google Maps walking mode.

## Run & verify

```
npm ci
npm run dev
npm test
npm run build
```

Ranked by haversine straight-line distance. The displayed walking distance is explicitly an **estimate (×1.3)**, not a routing-engine result; bridges can change the best walking choice. Never claims a bar is currently open or that free beer is still available.

## Data and annual refresh

- `data/venues.json`: every article venue, its district, verification flag, coordinates/address when confidently matched and OSM geocoding provenance. Unverified venues appear in the full list, not on the map or in ranking.
- `data/metadata.json`: list year, source URL and fetched date. An older-year dataset is visibly labelled as an archive rather than presented as a current list.
- `data/geocode-cache.json`: cached public Nominatim responses; avoid unnecessary repeated requests.
- `data/CHANGELOG.md` and `data/history/`: additions/removals and archived datasets.

### Refresh checklist (assistant or human)

**Target: current-year list checked at least one month before J-Day**, i.e. first Friday of November minus one calendar month. An article may not be published that early: never relabel an old list; report that the current list is not yet available and recheck closer to the date.

1. Check the existing article: https://migogkbh.dk/oel-og-nisser-paa-j-dag-i-koebenhavn/ . It may be updated in place.
2. **Also search the live web** for `J-dag København YEAR`, `Her kan du fejre J-dag YEAR` and `site:migogkbh.dk J-dag YEAR`. Do not assume the slug stays the same. Review dates/headline and choose the newest actual venue list, not a generic J-Day advert. The refresh script prints discovery search links but does not pretend to perform or validate web search automatically.
3. Dry run the reviewed URL (the year must occur in its title):
   ```
   npm run refresh:venues -- --year 2027 --source-url https://migogkbh.dk/REVIEWED-ARTICLE/
   ```
4. Review district/name diff. Then rerun with `--apply`. Vanished names are removed, unchanged names retain provenance, new names are unverified. If source markup/districts change or a new publisher is used, review/adapt the parser first; do not replace data with an empty/partial parse.
5. `npm run geocode` (single-threaded, at most one Nominatim request per 1.2 seconds; identifiable User-Agent). Review new names and aliases, district mismatches and ambiguous results; do not invent coordinates. Preserve manual overrides only after checking source evidence. A missing current year or incomplete source must be reported, not fabricated.
6. Update the changelog, run `npm test && npm run build`, test GPS + a typed `Nørreport Station` on mobile, review any unverified list, commit and deploy. Update the release banner from dataset metadata automatically.

A scheduled **Grok Bot assistant routine** is intended to run this review from **September through November**, notifying Φίλιππος of freshness, additions/removals, ambiguous venues and the live result. The routine lives outside this app; this repository does **not** create or configure it. Suggested cadence: early September, weekly in September/October (including the one-month deadline), and shortly before J-Day in November. The assistant must discover a newer article as well as checking the saved URL. No separate email/notification system is needed.

## Seasonal integrations

Eventnow and Topia Copenhagen link here from the Friday seven days before J-Day through the end of Sunday after it, computed each year in `Europe/Copenhagen`. The event is first Friday of November at 20:59 Copenhagen time. Future promotions point to this persistent URL; the dataset must be refreshed independently before each season.

## Deployment

Vite static build on Vercel, project `j-dag` in Filippos' projects. Custom domain `j-dag.6x7.gr`. `.vercel` and credentials are excluded from git. The app requires no application secrets or paid maps key.

Independent project, not an official Tuborg site. Venue roster credited to Mig og KBH; coordinates © OpenStreetMap contributors (ODbL 1.0). History: https://lex.dk/J-dag . Beer details: https://www.carlsberggroup.com/products/tuborg/tuborg-julebryg . 18+ / drink responsibly.

## How "closest" works

"Closest" is the shortest straight-line distance from your GPS or typed starting
point. The minutes shown are a rough walking estimate (distance × 1.3). The
directions button opens Google Maps walking directions (official keyless
[Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)),
where the real route, and other travel modes, are available.

Below the closest bar, "Nearby alternatives" shows the next 3 bars; "Show 10 more"
reveals 10 more per click until every listed bar is shown, nearest first (ties by
name). A new starting point resets the list to 3.

## Filters and bar details (free data only)

- Name, area and max-distance filters work on every bar. Distance needs a starting point.
- Smoking, outdoor seating, wheelchair access and usual hours come from OpenStreetMap
  (ODbL, © OpenStreetMap contributors), stored in `data/enrichment.json`, separate from the
  roster and keyed by venue name plus the pin it was matched to. If a venue's pin moves
  more than 50 m (e.g. after the yearly refresh), its old details are ignored until re-matched.
- Unknown is shown as unknown. Attribute filters only include bars where the detail is known.
- Smoking follows OSM's `smoking=*` values exactly; outdoor seating never implies smoking.
- No "open now" filter: special J-Day hours are not in OSM, so usual hours are shown as text.
- Beer prices: only hand-read from a bar's own menu, with source and date, in
  `data/enrichment-manual.json` (`facts`). No price sorting until enough bars list the same
  product and size. Wrong OSM matches go in `rejectMatches` with a reason.

Refresh (after the roster refresh each autumn):

    python3 scripts/enrich-osm.py --refresh   # one Overpass request, cached in data/osm-cache.json (gitignored)
    npm test && npm run build

Review the printed matches before committing. Contributing corrections to OpenStreetMap
itself is the best way to raise coverage.
