// Distance à vol d'oiseau (haversine) pour l'affichage « 850 m / 1,2 km »
// (design Onglet_Resto_v2). Géoloc côté client, lat/lng déjà en base.

const R = 6371; // km

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** « 850 m » sous 1 km, « 1,2 km » au-delà (format fr via locale). */
export function formatDistance(km: number, locale: string): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(km)} km`;
}
