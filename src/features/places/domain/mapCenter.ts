import type { Place } from "./filterPlaces";

const PARIS = { lat: 48.8566, lng: 2.3522 };

export function mapCenter(places: Place[]): { lat: number; lng: number } {
  const coords = places
    .map((p) => p.etablissement)
    .filter((e): e is typeof e & { lat: number; lng: number } => e.lat != null && e.lng != null);
  if (coords.length === 0) return PARIS;
  const lat = coords.reduce((s, e) => s + e.lat, 0) / coords.length;
  const lng = coords.reduce((s, e) => s + e.lng, 0) / coords.length;
  return { lat, lng };
}
