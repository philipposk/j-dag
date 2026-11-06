export function distanceMeters(a, b) {
  const rad = (n) => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function rankVenues(venues, at) {
  return venues.filter(v => v.verified && Number.isFinite(v.lat) && Number.isFinite(v.lng))
    .map(v => ({ ...v, distance: distanceMeters(at, v) }))
    .sort((a, b) => a.distance - b.distance);
}
export function walkingEstimate(meters) { return Math.max(20, Math.round(meters * 1.3 / 10) * 10); }
export function formatDistance(meters) { return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`; }
export function directionsLink(v, at) {
  const p = new URLSearchParams({ api: '1', destination: `${v.lat},${v.lng}`, travelmode: 'walking' });
  if (at) p.set('origin', `${at.lat},${at.lng}`);
  return `https://www.google.com/maps/dir/?${p}`;
}
