// Community-added bars: the "Missing a bar?" form, the unverified list with Report, and their own map pins.
// All visitor text is inserted with textContent; links are only http(s).
import { LIMITS, REASONS, cleanField, validateSuggestion, validateReport } from './community-shared.js';
export { validateSuggestion };
const API = '/api/community-bars';
const COPY = {
  en: { summary: 'Missing a bar?', intro: 'Know a J-Day bar that is not on the list? Add it. It appears right away as community-added and unverified.',
    name: 'Bar name', address: 'Street address in Copenhagen', source: 'Link showing it takes part (optional)', required: 'required',
    send: 'Add bar', sending: 'Checking address…',
    disclosure: 'We look up the address on OpenStreetMap to place the pin and check it is in Copenhagen. That does not confirm the bar exists, takes part, is open or is accessible. Your entry is public. We don’t ask for personal details; please don’t include any.',
    errors: { required: 'Please fill this in.', long: n => `Keep it under ${n} characters.`, url: 'Use a full link starting with http:// or https://.', chars: 'Please remove < > { } \\ characters.' },
    fix: 'Please fix the highlighted fields.', added: name => `Added “${name}” as community-added (unverified).`, received: 'Thanks, received.',
    official: name => `“${name}” is already on the official list.`, duplicate: name => `“${name}” has already been added by someone.`,
    address: 'We couldn’t find that address in Copenhagen. Try street, number and postcode.', area: 'That address is outside the area this map covers.',
    rate: 'Too many additions from here right now. Please try again later.', busy: 'The address lookup is busy. Please try again in a few seconds.',
    unavailable: 'Adding bars isn’t available right now. Please try again later.', failed: 'Couldn’t reach the server. Check your connection and try again.',
    listTitle: 'Community-added · unverified', listNote: 'Added by visitors. Not checked: we don’t know if these take part, are open or are accessible. The official list above is unchanged.',
    include: 'Include community-added bars when finding the closest', none: 'No community-added bars yet.', loadFail: 'Community-added bars couldn’t be loaded.',
    show: 'Show on map', report: 'Report', source2: 'Source', tag: 'Community-added · unverified',
    reportTitle: 'Report this entry', reason: 'Reason', note: 'Note (optional)', reportSend: 'Send report', cancel: 'Cancel', reporting: 'Sending…',
    reasons: { closed: 'Closed / doesn’t exist', not_participating: 'Not taking part in J-Day', wrong_place: 'Wrong address or pin', spam: 'Spam or offensive', other: 'Other' },
    reported: 'Thanks. The report was saved for the site owner to review. Nothing is removed automatically.', already: 'You already reported this one.', missing: 'This entry is no longer listed.',
    rrate: 'Too many reports from here today.', runavailable: 'Reporting isn’t available right now.' },
  da: { summary: 'Mangler der en bar?', intro: 'Kender du en J-dagsbar, der ikke er på listen? Tilføj den. Den vises med det samme som tilføjet af besøgende og ikke bekræftet.',
    name: 'Barens navn', address: 'Adresse i København', source: 'Link der viser, at den deltager (valgfrit)', required: 'skal udfyldes',
    send: 'Tilføj bar', sending: 'Tjekker adressen…',
    disclosure: 'Vi slår adressen op i OpenStreetMap for at placere nålen og tjekke, at den er i København. Det bekræfter ikke, at baren findes, deltager, har åbent eller er tilgængelig. Dit forslag er offentligt. Vi beder ikke om personlige oplysninger; skriv venligst ingen.',
    errors: { required: 'Udfyld venligst dette felt.', long: n => `Højst ${n} tegn.`, url: 'Brug et fuldt link, der starter med http:// eller https://.', chars: 'Fjern venligst tegnene < > { } \\.' },
    fix: 'Ret venligst de markerede felter.', added: name => `“${name}” er tilføjet som ikke bekræftet.`, received: 'Tak, modtaget.',
    official: name => `“${name}” er allerede på den officielle liste.`, duplicate: name => `“${name}” er allerede tilføjet af en anden.`,
    address: 'Vi kunne ikke finde adressen i København. Prøv gade, nummer og postnummer.', area: 'Adressen ligger uden for det område, kortet dækker.',
    rate: 'For mange tilføjelser herfra lige nu. Prøv igen senere.', busy: 'Adresseopslaget er optaget. Prøv igen om et øjeblik.',
    unavailable: 'Det er ikke muligt at tilføje barer lige nu. Prøv igen senere.', failed: 'Kunne ikke nå serveren. Tjek forbindelsen og prøv igen.',
    listTitle: 'Tilføjet af besøgende · ikke bekræftet', listNote: 'Tilføjet af besøgende. Ikke tjekket: vi ved ikke, om de deltager, har åbent eller er tilgængelige. Den officielle liste ovenfor er uændret.',
    include: 'Medtag barer tilføjet af besøgende, når den nærmeste findes', none: 'Ingen barer tilføjet af besøgende endnu.', loadFail: 'Barer tilføjet af besøgende kunne ikke hentes.',
    show: 'Vis på kortet', report: 'Anmeld', source2: 'Kilde', tag: 'Tilføjet af besøgende · ikke bekræftet',
    reportTitle: 'Anmeld dette forslag', reason: 'Årsag', note: 'Bemærkning (valgfri)', reportSend: 'Send anmeldelse', cancel: 'Annullér', reporting: 'Sender…',
    reasons: { closed: 'Lukket / findes ikke', not_participating: 'Deltager ikke i J-dag', wrong_place: 'Forkert adresse eller nål', spam: 'Spam eller stødende', other: 'Andet' },
    reported: 'Tak. Anmeldelsen er gemt, så ejeren af siden kan se på den. Intet fjernes automatisk.', already: 'Du har allerede anmeldt dette forslag.', missing: 'Forslaget er ikke længere på listen.',
    rrate: 'For mange anmeldelser herfra i dag.', runavailable: 'Anmeldelse er ikke mulig lige nu.' },
};
const waitFrom = async t0 => { const left = t0 + 3200 - Date.now(); if (left > 0) await new Promise(r => setTimeout(r, left)); }; // server rejects sub-3s forms
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

// Same text in the same tab -> same key, so a retry after a timeout can't add twice.
export function submissionKey(f, session) {
  let h = 2166136261; for (const ch of `${session}|${cleanField(f.name)}|${cleanField(f.address)}|${cleanField(f.source)}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return `${session}-${h.toString(36)}`.slice(0, 64);
}
export async function postJson(body, fetchFn = globalThis.fetch) {
  try { const r = await fetchFn(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {}; try { data = await r.json(); } catch {}
    return { status: r.status, data };
  } catch { return { status: 0, data: {} }; }
}
// Maps a server answer to a message key. Only 'added' and 'reported' are success.
export function outcome(kind, { status, data }) {
  if (status === 0) return kind === 'add' ? 'failed' : 'runavailable';
  if (status === 429) return kind === 'add' ? 'rate' : 'rrate';
  if (kind === 'add') {
    if (status === 201 && data.status === 'added') return 'added';
    if (status === 202) return 'received';
    if (['official', 'duplicate', 'address', 'area'].includes(data.status)) return data.status;
    if (data.error === 'busy') return 'busy';
    return status >= 500 ? 'unavailable' : 'failed';
  }
  if (data.status === 'reported' || data.status === 'received') return 'reported';
  if (data.status === 'already' || data.status === 'missing') return data.status;
  return 'runavailable';
}
export function toVenue(b) {
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!b.id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { id: String(b.id), name: cleanField(b.name).slice(0, LIMITS.name), address: cleanField(b.address).slice(0, LIMITS.address),
    sourceUrl: b.sourceUrl ? safeUrl(b.sourceUrl) : null, lat, lng, verified: true, community: true, district: '' };
}

export function mountCommunity({ host, map, L, getLang, onChange = () => {}, onSelect = () => {}, fetchFn = globalThis.fetch }) {
  const c = () => COPY[getLang()] ?? COPY.en;
  const fields = ['name', 'address', 'source'];
  host.innerHTML = `<section class="community" id="community" aria-labelledby="community-title">
<h2 id="community-title"><span data-s="listTitle"></span> <span class="count" id="community-count"></span></h2>
<p class="small-note"><span class="community-swatch" aria-hidden="true"></span> <span data-s="listNote"></span></p>
<label class="community-include"><input type="checkbox" id="community-include"> <span data-s="include"></span></label>
<p id="community-load" class="small-note" role="status"></p><ul id="community-list" class="community-list"></ul>
<details class="suggest" id="suggest"><summary data-s="summary"></summary><p data-s="intro"></p>
<form id="suggest-form" novalidate>${fields.map(k => `<p><label for="suggest-${k}"><span data-s="${k}"></span>${k === 'source' ? '' : ' <small data-s="required"></small>'}</label>
<input id="suggest-${k}" name="${k}" type="${k === 'source' ? 'url' : 'text'}" maxlength="${LIMITS[k] + 20}" autocomplete="off" ${k === 'source' ? 'inputmode="url"' : 'required aria-required="true"'} aria-describedby="suggest-${k}-err">
<span class="suggest-err" id="suggest-${k}-err"></span></p>`).join('')}
<p class="suggest-hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></p>
<p class="small-note" id="suggest-disclosure" data-s="disclosure"></p>
<p class="suggest-actions"><button class="button primary" type="submit" id="suggest-send" aria-describedby="suggest-disclosure"></button></p>
<p id="suggest-status" role="status" aria-live="polite" tabindex="-1"></p></form></details></section>`;
  const $ = s => host.querySelector(s), form = $('#suggest-form'), status = $('#suggest-status'), btn = $('#suggest-send'), list = $('#community-list');
  const session = (globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2) + Date.now()).replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
  const layer = L.layerGroup().addTo(map), pins = new Map();
  let bars = [], loadState = 'loading', lastErrors = {}, lastStatus = null, busy = false, startedAt = 0, openReport = null;
  $('#suggest').addEventListener('toggle', () => { if (!startedAt) startedAt = Date.now(); });
  $('#community-include').addEventListener('change', () => onChange());

  const pin = v => { const m = L.circleMarker([v.lat, v.lng], { radius: 6, color: '#b98cff', weight: 2, dashArray: '3 3', fillColor: '#4b2a7a', fillOpacity: 1 });
    const box = document.createElement('div'), tag = document.createElement('small'), title = document.createElement('strong'), addr = document.createElement('p');
    tag.className = 'community-tag'; title.textContent = v.name; addr.textContent = v.address; box.append(tag, document.createElement('br'), title, addr);
    m.bindPopup(box); m.on('popupopen', () => { tag.textContent = c().tag; }); m.on('click', () => onSelect(v)); m.addTo(layer); pins.set(v.id, m); };
  const renderList = () => {
    $('#community-count').textContent = loadState === 'ok' ? `(${bars.length})` : '';
    $('#community-load').textContent = loadState === 'fail' ? c().loadFail : loadState === 'ok' && !bars.length ? c().none : '';
    list.replaceChildren(...bars.map(v => { const li = document.createElement('li'); li.id = `community-${v.id}`;
      const name = document.createElement('strong'); name.textContent = v.name;
      const addr = document.createElement('span'); addr.textContent = v.address;
      const actions = document.createElement('span'); actions.className = 'community-actions';
      const show = document.createElement('button'); show.type = 'button'; show.className = 'text-button'; show.textContent = c().show;
      show.addEventListener('click', () => { onSelect(v); map.setView([v.lat, v.lng], 17); pins.get(v.id)?.openPopup(); });
      const rep = document.createElement('button'); rep.type = 'button'; rep.className = 'text-button'; rep.textContent = c().report;
      rep.setAttribute('aria-expanded', String(openReport === v.id)); rep.addEventListener('click', () => { openReport = openReport === v.id ? null : v.id; renderList(); list.querySelector(`#report-${v.id} select`)?.focus(); });
      actions.append(show, rep);
      if (v.sourceUrl) { const a = document.createElement('a'); a.href = v.sourceUrl; a.rel = 'nofollow ugc noopener noreferrer'; a.target = '_blank'; a.textContent = c().source2 + ' ↗'; actions.append(a); }
      li.append(name, addr, actions);
      if (openReport === v.id) li.append(reportForm(v));
      return li; }));
  };
  const reportForm = v => { const f = document.createElement('form'); f.id = `report-${v.id}`; f.className = 'report-form'; f.noValidate = true;
    const legend = document.createElement('p'); legend.className = 'small-note'; legend.textContent = `${c().reportTitle}: ${v.name}`;
    const rl = document.createElement('label'), sel = document.createElement('select'); rl.htmlFor = sel.id = `report-reason-${v.id}`; rl.textContent = c().reason;
    sel.required = true; sel.append(new Option('—', ''), ...REASONS.map(r => new Option(c().reasons[r], r)));
    const nl = document.createElement('label'), note = document.createElement('textarea'); nl.htmlFor = note.id = `report-note-${v.id}`; nl.textContent = c().note; note.maxLength = LIMITS.note; note.rows = 2;
    const hp = document.createElement('input'); hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.className = 'suggest-hp'; hp.setAttribute('aria-hidden', 'true');
    const send = document.createElement('button'); send.className = 'button primary'; send.type = 'submit'; send.textContent = c().reportSend;
    const cancel = document.createElement('button'); cancel.className = 'button'; cancel.type = 'button'; cancel.textContent = c().cancel; cancel.addEventListener('click', () => { openReport = null; renderList(); });
    const st = document.createElement('p'); st.setAttribute('role', 'status'); st.tabIndex = -1;
    const opened = Date.now();
    f.append(legend, rl, sel, nl, note, hp, send, cancel, st);
    f.addEventListener('submit', async ev => { ev.preventDefault(); if (send.disabled) return;
      const body = { action: 'report', barId: v.id, reason: sel.value, note: note.value, website: hp.value, startedAt: opened };
      if (Object.keys(validateReport(body)).length) { sel.setAttribute('aria-invalid', 'true'); st.textContent = c().fix; sel.focus(); return; }
      send.disabled = true; send.textContent = c().reporting; await waitFrom(opened);
      const key = outcome('report', await postJson(body, fetchFn));
      send.disabled = false; send.textContent = c().reportSend; st.textContent = c()[key]; st.focus();
      if (key === 'reported' || key === 'already') { send.disabled = true; } });
    return f; };
  const add = v => { if (!v || bars.some(b => b.id === v.id)) return; bars.unshift(v); pin(v); };

  const values = () => Object.fromEntries(fields.map(k => [k, $(`#suggest-${k}`).value]));
  const showErrors = () => { for (const k of fields) { const e = lastErrors[k], input = $(`#suggest-${k}`);
    $(`#suggest-${k}-err`).textContent = e ? (e === 'long' ? c().errors.long(LIMITS[k]) : c().errors[e]) : '';
    e ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid'); } };
  const say = (key, arg) => { lastStatus = key ? [key, arg] : null; const m = key ? c()[key] : '';
    status.textContent = typeof m === 'function' ? m(arg) : m; status.dataset.state = key ?? ''; };
  const setBusy = b => { busy = b; btn.disabled = b; btn.setAttribute('aria-busy', String(b)); btn.textContent = b ? c().sending : c().send; };
  form.addEventListener('submit', async ev => { ev.preventDefault(); if (busy) return;
    lastErrors = validateSuggestion(values()); showErrors();
    const first = fields.find(k => lastErrors[k]); if (first) { say('fix'); $(`#suggest-${first}`).focus(); return; }
    setBusy(true); say(null); if (!startedAt) startedAt = Date.now(); await waitFrom(startedAt);
    const v = values(), res = await postJson({ action: 'add', ...v, website: form.website.value, startedAt, key: submissionKey(v, session) }, fetchFn);
    const key = outcome('add', res); setBusy(false);
    if (key === 'added') { const nv = toVenue(res.data.bar); add(nv); renderList(); onChange(); for (const k of fields) $(`#suggest-${k}`).value = ''; say('added', nv?.name); }
    else say(key, res.data.name);
    status.focus(); });

  const relabel = () => { host.querySelectorAll('[data-s]').forEach(el => { el.textContent = c()[el.dataset.s]; }); setBusy(busy); showErrors();
    if (lastStatus) say(...lastStatus); renderList(); };
  relabel();
  (async () => { try { const r = await fetchFn(API, { headers: { Accept: 'application/json' } }); if (!r.ok) throw 0;
      const data = await r.json(); (Array.isArray(data.bars) ? data.bars : []).slice(0, 1000).map(toVenue).filter(Boolean).reverse().forEach(add); loadState = 'ok';
    } catch { loadState = 'fail'; }
    renderList(); onChange(); })();
  return {
    relabel, label: () => c().tag,
    included: () => ($('#community-include').checked ? bars : []),
    find: name => bars.find(b => b.name === name),
    openPin: name => { const v = bars.find(b => b.name === name); if (v) pins.get(v.id)?.openPopup(); },
  };
}
