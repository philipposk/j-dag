// Static, crawlable head + body for each language page. The JS app replaces #app on load
// with the interactive version of the same content (no hidden or extra SEO-only text).
import fs from 'node:fs';
export const SITE = 'https://j-dag.6x7.gr';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T = {
  en: { path: '/', locale: 'en_DK', title: 'J-Day Copenhagen bar finder — closest Christmas beer bar near you',
    desc: 'Find the closest bar on the J-Day list in Copenhagen: share your location or type an address, see the map, filter by area, smoking or outdoor seating, and get walking directions.',
    h1: 'J-Day bar finder for Copenhagen', lead: 'Find the closest bar on this year’s J-Day list. Share your location or type an address to see the nearest listed bars on a map, with walking directions. Free, no account.',
    listH: 'All listed J-Day bars', source: 'Bar list', jsNote: 'The map and closest-bar search need JavaScript.' },
  da: { path: '/da/', locale: 'da_DK', title: 'J-dag København — find den nærmeste bar med julebryg',
    desc: 'Find den nærmeste bar på J-dagslisten i København: del din placering eller skriv en adresse, se kortet, filtrér på område, rygning eller udeservering, og få en gårute.',
    h1: 'Find en J-dagsbar i København', lead: 'Find den nærmeste bar på årets J-dagsliste. Del din placering eller skriv en adresse for at se de nærmeste barer på kortet med gårute. Gratis, ingen konto.',
    listH: 'Alle barer på J-dagslisten', source: 'Barliste', jsNote: 'Kortet og søgningen efter nærmeste bar kræver JavaScript.' },
};
export function seoHtml(lang) {
  const t = T[lang], venues = read('./data/venues.json'), meta = read('./data/metadata.json');
  const url = SITE + t.path, img = SITE + '/og.png';
  const ld = { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'J-dag KBH', url, inLanguage: lang,
    description: t.desc, applicationCategory: 'TravelApplication', operatingSystem: 'Web', isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'DKK' }, creator: { '@type': 'Organization', name: '6×7', url: 'https://6x7.gr' } };
  const head = `<title>${esc(t.title)}</title><meta name="description" content="${esc(t.desc)}"><link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${SITE}/"><link rel="alternate" hreflang="da" href="${SITE}/da/"><link rel="alternate" hreflang="x-default" href="${SITE}/">
<meta property="og:type" content="website"><meta property="og:site_name" content="J-dag KBH"><meta property="og:locale" content="${t.locale}"><meta property="og:url" content="${url}"><meta property="og:title" content="${esc(t.title)}"><meta property="og:description" content="${esc(t.desc)}"><meta property="og:image" content="${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(t.h1)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(t.title)}"><meta name="twitter:description" content="${esc(t.desc)}"><meta name="twitter:image" content="${img}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g,'\\u003c')}</script>`;
  const districts = [...new Set(venues.map(v => v.district))];
  const body = `<main class="shell static-page"><h1 class="static-h1">${esc(t.h1)}</h1><p>${esc(t.lead)}</p><p><noscript>${esc(t.jsNote)}</noscript></p>
<h2>${esc(t.listH)} (${meta.year}, ${venues.length})</h2>${districts.map(d => `<h3>${esc(d)}</h3><ul>${venues.filter(v => v.district === d).map(v => `<li>${esc(v.name)}${v.address ? ` — ${esc(v.address)}` : ''}</li>`).join('')}</ul>`).join('')}
<p>${esc(t.source)}: <a href="${esc(meta.sourceUrl)}">${esc(meta.sourceName)} (${meta.year})</a> · <a href="https://github.com/philipposk/j-dag">GitHub</a></p></main>`;
  return { head, body };
}
