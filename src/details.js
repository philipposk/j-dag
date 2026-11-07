import enrichment from '../data/enrichment.json' with { type: 'json' };
import manual from '../data/enrichment-manual.json' with { type: 'json' };
import { distanceMeters } from './geo.js';

// Smoking values exactly as OSM defines them (wiki Key:smoking); never inferred from outdoor seating.
export const SMOKING_GROUPS = { inside: ['yes', 'separated', 'isolated', 'dedicated'], outside: ['outside'], none: ['no'] };

// Details for one venue, or nulls when unknown. OSM data is ignored if the venue's pin
// has moved more than 50 m since it was matched (e.g. a new roster year reused the name).
export function venueDetails(v, data = enrichment, facts = manual.facts) {
  const key = v.name.toLowerCase();
  const e = data.venues[key];
  const fresh = e && Number.isFinite(v.lat) && distanceMeters({ lat: e.pin[0], lng: e.pin[1] }, v) < 50;
  const f = fresh ? e.fields : {};
  const yesNo = x => (x === 'yes' ? true : x === 'no' ? false : null);
  return {
    smoking: f.smoking ?? null,
    outdoorSeating: yesNo(f.outdoor_seating),
    wheelchair: ['yes', 'limited', 'no'].includes(f.wheelchair) ? f.wheelchair : null,
    hours: f.opening_hours ?? null,
    website: safeUrl(f.website ?? f['contact:website']),
    osmUrl: fresh ? safeUrl(e.osm.url) : null,
    checked: f['check_date:opening_hours'] ?? f.check_date ?? null,
    beerPrices: (facts[key]?.beerPrice ?? []).filter(p => safeUrl(p.source)),
  };
}

// Only http(s) links are ever rendered; anything else becomes null.
export const safeUrl = u => { try { const x = new URL(u); return ['https:', 'http:'].includes(x.protocol) ? x.href : null; } catch { return null; } };

export const DEFAULT_FILTERS = { name: '', district: '', radius: 0, smoking: '', outdoor: false, wheelchair: '' };

const fold = s => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'aa');

// Pure filter: unknown attribute values never pass an attribute filter.
export function matchesFilters(v, f, origin, details = venueDetails(v)) {
  if (f.name && !fold(v.name).includes(fold(f.name.trim()))) return false;
  if (f.district && v.district !== f.district) return false;
  if (f.radius && origin && distanceMeters(origin, v) > f.radius) return false;
  if (f.smoking && !(SMOKING_GROUPS[f.smoking] || []).includes(details.smoking)) return false;
  if (f.outdoor && details.outdoorSeating !== true) return false;
  if (f.wheelchair === 'yes' && details.wheelchair !== 'yes') return false;
  if (f.wheelchair === 'some' && !['yes', 'limited'].includes(details.wheelchair)) return false;
  return true;
}
export const activeFilterCount = f => Object.entries(f).filter(([k, x]) => x !== DEFAULT_FILTERS[k]).length;
