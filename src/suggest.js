// "Missing a bar?" — prepares an email in the visitor's own mail app. Nothing is sent from this site.
export const RECIPIENT = 'filippos@6x7.gr';
export const LIMITS = { name: 120, address: 200, source: 500 };

const COPY = {
  en: { summary: 'Missing a bar?', intro: 'Know a J-Day bar that is not on the list? Prepare an email to us.',
    name: 'Bar name', address: 'Address', source: 'Link showing it takes part (optional)', required: 'required',
    open: 'Open email', copy: 'Copy text', disclosure: 'This opens your own email app with the text filled in. Nothing is sent until you press send there. Suggestions are checked by hand before anything changes on the map, and we can’t promise a reply.',
    errors: { required: 'Please fill this in.', long: n => `Keep it under ${n} characters.`, url: 'Use a full link starting with http:// or https://.' },
    fix: 'Please fix the highlighted fields.', opened: 'Your email app should open now. Send the email there — nothing has been sent yet. If nothing opened, use “Copy text”.',
    copied: 'Copied. Paste it into an email to filippos@6x7.gr.', manual: 'Couldn’t copy automatically. The text is selected below — copy it and email it to filippos@6x7.gr.',
    subject: 'J-dag: missing bar', fName: 'Bar', fAddress: 'Address', fSource: 'Source', none: '(none)', fLang: 'Language', fYear: 'List year', to: 'To', subj: 'Subject' },
  da: { summary: 'Mangler der en bar?', intro: 'Kender du en J-dagsbar, der ikke er på listen? Forbered en e-mail til os.',
    name: 'Barens navn', address: 'Adresse', source: 'Link der viser, at den deltager (valgfrit)', required: 'skal udfyldes',
    open: 'Åbn e-mail', copy: 'Kopiér tekst', disclosure: 'Dette åbner din egen e-mailapp med teksten udfyldt. Intet sendes, før du trykker send dér. Forslag tjekkes manuelt, før noget ændres på kortet, og vi kan ikke love et svar.',
    errors: { required: 'Udfyld venligst dette felt.', long: n => `Højst ${n} tegn.`, url: 'Brug et fuldt link, der starter med http:// eller https://.' },
    fix: 'Ret venligst de markerede felter.', opened: 'Din e-mailapp burde åbne nu. Send e-mailen dér — intet er sendt endnu. Hvis intet åbnede, brug “Kopiér tekst”.',
    copied: 'Kopieret. Indsæt det i en e-mail til filippos@6x7.gr.', manual: 'Kunne ikke kopiere automatisk. Teksten er markeret nedenfor — kopiér den og send den til filippos@6x7.gr.',
    subject: 'J-dag: manglende bar', fName: 'Bar', fAddress: 'Adresse', fSource: 'Kilde', none: '(ingen)', fLang: 'Sprog', fYear: 'Listeår', to: 'Til', subj: 'Emne' },
};
const clean = s => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

export function validateSuggestion(f) {
  const e = {};
  for (const k of ['name', 'address', 'source']) {
    const v = clean(f[k]);
    if (!v) { if (k !== 'source') e[k] = 'required'; continue; }
    if (v.length > LIMITS[k]) { e[k] = 'long'; continue; }
    if (k === 'source') { let u; try { u = new URL(v); } catch { e.source = 'url'; continue; } if (!/^https?:$/.test(u.protocol)) e.source = 'url'; }
  }
  return e;
}

export function buildEmail(f, lang, year) {
  const c = COPY[lang] ?? COPY.en, name = clean(f.name), address = clean(f.address), source = clean(f.source);
  const subject = `${c.subject} – ${name}`;
  const body = [`${c.fName}: ${name}`, `${c.fAddress}: ${address}`, `${c.fSource}: ${source || c.none}`, '', `${c.fLang}: ${lang}`, `${c.fYear}: ${year}`].join('\n');
  return { subject, body, href: `mailto:${RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    text: `${c.to}: ${RECIPIENT}\n${c.subj}: ${subject}\n\n${body}` };
}

export async function copyText(text, clipboard = globalThis.navigator?.clipboard) {
  try { if (!clipboard?.writeText) return false; await clipboard.writeText(text); return true; } catch { return false; }
}

// Builds the section once; relabel(lang) only changes labels, so typed values survive language switches.
export function mountSuggest(host, getLang, year, openUrl = href => { location.href = href; }) {
  const fields = ['name', 'address', 'source'];
  host.innerHTML = `<details class="suggest" id="suggest"><summary data-s="summary"></summary><p data-s="intro"></p>
<form id="suggest-form" novalidate>${fields.map(k => `<p><label for="suggest-${k}"><span data-s="${k}"></span>${k === 'source' ? '' : ' <small data-s="required"></small>'}</label>
<input id="suggest-${k}" name="${k}" type="${k === 'source' ? 'url' : 'text'}" maxlength="${LIMITS[k] + 20}" autocomplete="off" ${k === 'source' ? 'inputmode="url"' : 'required aria-required="true"'} aria-describedby="suggest-${k}-err">
<span class="suggest-err" id="suggest-${k}-err"></span></p>`).join('')}
<p class="small-note" id="suggest-disclosure" data-s="disclosure"></p>
<p class="suggest-actions"><button class="button primary" type="submit" data-s="open" aria-describedby="suggest-disclosure"></button> <button class="button" type="button" id="suggest-copy" data-s="copy"></button></p>
<p id="suggest-status" role="status" aria-live="polite"></p><textarea id="suggest-text" readonly rows="8" hidden aria-labelledby="suggest-status"></textarea></form></details>`;
  const $ = s => host.querySelector(s), form = $('#suggest-form'), status = $('#suggest-status'), area = $('#suggest-text');
  let lastErrors = {}, lastStatus = null;
  const values = () => Object.fromEntries(fields.map(k => [k, $(`#suggest-${k}`).value]));
  const showErrors = () => { const c = COPY[getLang()] ?? COPY.en;
    for (const k of fields) { const e = lastErrors[k], input = $(`#suggest-${k}`);
      $(`#suggest-${k}-err`).textContent = e ? (e === 'long' ? c.errors.long(LIMITS[k]) : c.errors[e]) : '';
      e ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid'); } };
  const say = key => { lastStatus = key; status.textContent = key ? (COPY[getLang()] ?? COPY.en)[key] : ''; };
  const check = () => { lastErrors = validateSuggestion(values()); showErrors();
    const first = fields.find(k => lastErrors[k]); if (first) { say('fix'); $(`#suggest-${first}`).focus(); return null; }
    return buildEmail(values(), getLang(), year); };
  form.addEventListener('submit', ev => { ev.preventDefault(); const e = check(); if (!e) return; say('opened'); openUrl(e.href); });
  $('#suggest-copy').addEventListener('click', async () => { const e = check(); if (!e) return;
    if (await copyText(e.text)) { area.hidden = true; say('copied'); }
    else { area.value = e.text; area.hidden = false; say('manual'); area.focus(); area.select(); } });
  const relabel = () => { const c = COPY[getLang()] ?? COPY.en; host.querySelectorAll('[data-s]').forEach(el => { el.textContent = c[el.dataset.s]; });
    showErrors(); if (lastStatus) say(lastStatus);
    if (!area.hidden) { const e = buildEmail(values(), getLang(), year); area.value = e.text; } };
  relabel();
  return relabel;
}
