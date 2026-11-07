// "Missing a bar?" — visitors send a suggestion from the page; the server emails it to the owner for manual review.
// Nothing is added to the map or stored by this site.
export const LIMITS = { name: 120, address: 200, source: 500 };

const COPY = {
  en: { summary: 'Missing a bar?', intro: 'Know a J-Day bar that is not on the list? Tell us.',
    name: 'Bar name', address: 'Address', source: 'Link showing it takes part (optional)', required: 'required',
    send: 'Send suggestion', sending: 'Sending…',
    disclosure: 'We send only the bar name, address, link and page language by email to Filippos (6×7), who checks it by hand. Nothing is added to the map automatically, and we can’t promise a reply. Don’t include personal details.',
    errors: { required: 'Please fill this in.', long: n => `Keep it under ${n} characters.`, url: 'Use a full link starting with http:// or https://.' },
    fix: 'Please fix the highlighted fields.', sent: 'Sent — thank you. It has been handed to our email service for review. It won’t appear on the map until it has been checked.',
    rate: 'Too many suggestions from here right now. Please try again later.', unavailable: 'Suggestions are not switched on right now. You can email filippos@6x7.gr instead.',
    failed: 'Couldn’t send. Please try again, or email filippos@6x7.gr.' },
  da: { summary: 'Mangler der en bar?', intro: 'Kender du en J-dagsbar, der ikke er på listen? Fortæl os det.',
    name: 'Barens navn', address: 'Adresse', source: 'Link der viser, at den deltager (valgfrit)', required: 'skal udfyldes',
    send: 'Send forslag', sending: 'Sender…',
    disclosure: 'Vi sender kun barens navn, adresse, link og sidens sprog på e-mail til Filippos (6×7), som tjekker det manuelt. Intet tilføjes automatisk til kortet, og vi kan ikke love et svar. Skriv ikke personlige oplysninger.',
    errors: { required: 'Udfyld venligst dette felt.', long: n => `Højst ${n} tegn.`, url: 'Brug et fuldt link, der starter med http:// eller https://.' },
    fix: 'Ret venligst de markerede felter.', sent: 'Sendt — tak. Det er givet videre til vores e-mailtjeneste til gennemsyn. Det kommer ikke på kortet, før det er tjekket.',
    rate: 'For mange forslag herfra lige nu. Prøv igen senere.', unavailable: 'Forslag er ikke slået til lige nu. Du kan skrive til filippos@6x7.gr i stedet.',
    failed: 'Kunne ikke sende. Prøv igen, eller skriv til filippos@6x7.gr.' },
};
export const cleanField = s => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

export function validateSuggestion(f) {
  const e = {};
  for (const k of ['name', 'address', 'source']) {
    const v = cleanField(f[k]);
    if (!v) { if (k !== 'source') e[k] = 'required'; continue; }
    if (v.length > LIMITS[k]) { e[k] = 'long'; continue; }
    if (k === 'source') { let u; try { u = new URL(v); } catch { e.source = 'url'; continue; } if (!/^https?:$/.test(u.protocol)) e.source = 'url'; }
  }
  return e;
}

// Same text + same session -> same key, so a retry after a timeout can't send a second email.
export function resultKey(f, session) {
  let h = 2166136261; for (const ch of `${session}|${cleanField(f.name)}|${cleanField(f.address)}|${cleanField(f.source)}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return `${session}-${h.toString(36)}`.slice(0, 64);
}

export async function submitSuggestion(f, meta, fetchFn = globalThis.fetch) {
  const body = { name: cleanField(f.name), address: cleanField(f.address), source: cleanField(f.source), lang: meta.lang, startedAt: meta.startedAt, website: meta.website ?? '', key: meta.key };
  try {
    const r = await fetchFn('/api/suggest-bar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 200) return 'sent';
    return r.status === 429 ? 'rate' : r.status === 503 ? 'unavailable' : 'failed';
  } catch { return 'failed'; }
}

// Builds the section once; relabel() only changes labels, so typed values survive language switches.
export function mountSuggest(host, getLang, fetchFn) {
  const fields = ['name', 'address', 'source'];
  host.innerHTML = `<details class="suggest" id="suggest"><summary data-s="summary"></summary><p data-s="intro"></p>
<form id="suggest-form" novalidate>${fields.map(k => `<p><label for="suggest-${k}"><span data-s="${k}"></span>${k === 'source' ? '' : ' <small data-s="required"></small>'}</label>
<input id="suggest-${k}" name="${k}" type="${k === 'source' ? 'url' : 'text'}" maxlength="${LIMITS[k] + 20}" autocomplete="off" ${k === 'source' ? 'inputmode="url"' : 'required aria-required="true"'} aria-describedby="suggest-${k}-err">
<span class="suggest-err" id="suggest-${k}-err"></span></p>`).join('')}
<p class="suggest-hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></p>
<p class="small-note" id="suggest-disclosure" data-s="disclosure"></p>
<p class="suggest-actions"><button class="button primary" type="submit" id="suggest-send" aria-describedby="suggest-disclosure"></button></p>
<p id="suggest-status" role="status" aria-live="polite"></p></form></details>`;
  const $ = s => host.querySelector(s), form = $('#suggest-form'), status = $('#suggest-status'), btn = $('#suggest-send');
  const session = (globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2)).replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
  let lastErrors = {}, lastStatus = null, busy = false, startedAt = 0;
  host.querySelector('#suggest').addEventListener('toggle', () => { if (!startedAt) startedAt = Date.now(); });
  const c = () => COPY[getLang()] ?? COPY.en;
  const values = () => Object.fromEntries(fields.map(k => [k, $(`#suggest-${k}`).value]));
  const showErrors = () => { for (const k of fields) { const e = lastErrors[k], input = $(`#suggest-${k}`);
    $(`#suggest-${k}-err`).textContent = e ? (e === 'long' ? c().errors.long(LIMITS[k]) : c().errors[e]) : '';
    e ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid'); } };
  const say = key => { lastStatus = key; status.textContent = key ? c()[key] : ''; status.dataset.state = key ?? ''; };
  const setBusy = b => { busy = b; btn.disabled = b; btn.setAttribute('aria-busy', String(b)); btn.textContent = b ? c().sending : c().send; };
  form.addEventListener('submit', async ev => { ev.preventDefault(); if (busy) return;
    lastErrors = validateSuggestion(values()); showErrors();
    const first = fields.find(k => lastErrors[k]); if (first) { say('fix'); $(`#suggest-${first}`).focus(); return; }
    setBusy(true); say(null);
    const v = values(), result = await submitSuggestion(v, { lang: getLang(), startedAt: startedAt || Date.now(), website: form.website.value, key: resultKey(v, session) }, fetchFn);
    setBusy(false); say(result);
    if (result === 'sent') { for (const k of fields) $(`#suggest-${k}`).value = ''; }
    status.focus?.(); });
  const relabel = () => { host.querySelectorAll('[data-s]').forEach(el => { el.textContent = c()[el.dataset.s]; }); setBusy(busy); showErrors(); if (lastStatus) say(lastStatus); };
  status.tabIndex = -1; relabel();
  return relabel;
}
