// Page metadata copy shared by the build-time prerender and the in-app language switch.
export const SITE = 'https://j-dag.6x7.gr';
export const SEO_COPY = {
  en: { path: '/', locale: 'en_DK', title: 'J-Day Copenhagen bar finder — closest Christmas beer bar near you',
    desc: 'Find the closest bar on the J-Day list in Copenhagen: share your location or type an address, see the map, filter by area, smoking or outdoor seating, and get walking directions.',
    h1: 'J-Day bar finder for Copenhagen', lead: 'Find the closest bar on this year’s J-Day list. Share your location or type an address to see the nearest listed bars on a map, with walking directions. Free, no account.',
    listH: 'All listed J-Day bars', source: 'Bar list', jsNote: 'The map and closest-bar search need JavaScript.', tentative: 'Likely location only — this pin is our best match, not confirmed.' },
  da: { path: '/da/', locale: 'da_DK', title: 'J-dag København — find den nærmeste bar med julebryg',
    desc: 'Find den nærmeste bar på J-dagslisten i København: del din placering eller skriv en adresse, se kortet, filtrér på område, rygning eller udeservering, og få en gårute.',
    h1: 'Find en J-dagsbar i København', lead: 'Find den nærmeste bar på årets J-dagsliste. Del din placering eller skriv en adresse for at se de nærmeste barer på kortet med gårute. Gratis, ingen konto.',
    listH: 'Alle barer på J-dagslisten', source: 'Barliste', jsNote: 'Kortet og søgningen efter nærmeste bar kræver JavaScript.', tentative: 'Kun sandsynlig placering — bedste match, ikke bekræftet.' },
};

// Point head metadata at the page for `lang` (used when the toggle changes the URL).
export function applyHeadCopy(lang, doc = document) {
  const t = SEO_COPY[lang], url = SITE + t.path, set = (sel, v) => doc.querySelector(sel)?.setAttribute('content', v);
  doc.title = t.title;
  set('meta[name="description"]', t.desc); set('meta[property="og:title"]', t.title); set('meta[name="twitter:title"]', t.title);
  set('meta[property="og:description"]', t.desc); set('meta[name="twitter:description"]', t.desc);
  set('meta[property="og:url"]', url); set('meta[property="og:locale"]', t.locale); set('meta[property="og:image:alt"]', t.h1);
  doc.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
}
