// Static, crawlable head + body for each language page. The JS app replaces #app on load
// with the interactive version of the same content (no hidden or extra SEO-only text).
import fs from 'node:fs';
import { SITE, SEO_COPY as T } from './src/seo-copy.js';
export { SITE };
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
<h2>${esc(t.listH)} (${meta.year}, ${venues.length})</h2>${districts.map(d => `<h3>${esc(d)}</h3><ul>${venues.filter(v => v.district === d).map(v => `<li>${esc(v.name)}${v.address ? ` — ${esc(v.address)}` : ''}${v.tentative ? ` <small>(${esc(t.tentative)})</small>` : ''}</li>`).join('')}</ul>`).join('')}
<p>${esc(t.source)}: <a href="${esc(meta.sourceUrl)}">${esc(meta.sourceName)} (${meta.year})</a> · <a href="https://github.com/philipposk/j-dag">GitHub</a></p></main>`;
  return { head, body };
}
