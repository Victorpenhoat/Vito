"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useTranslations } from "next-intl";
import { mapCenter } from "../domain/mapCenter";
import type { Place } from "../domain/filterPlaces";

function pin(favorite: boolean): L.DivIcon {
  // Favori = disque plein or ; recommandé (non favori) = disque contour accent. Couleurs via tokens CSS.
  const html = favorite
    ? `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:var(--gold);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`
    : `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#fff;border:2px solid var(--accent);box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`;
  return L.divIcon({ className: "", html, iconSize: [14, 14], iconAnchor: [7, 7] });
}

export function PlacesMap({ places, locale }: { places: Place[]; locale: string }) {
  const t = useTranslations("places");
  const withCoords = places.filter((p) => p.etablissement.lat != null && p.etablissement.lng != null);
  const sansLoc = places.length - withCoords.length;
  const center = mapCenter(places);
  return (
    <div className="flex flex-col gap-2">
      <div data-testid="places-map" className="overflow-hidden rounded-card border border-line">
        <MapContainer center={[center.lat, center.lng]} zoom={12} scrollWheelZoom className="h-[60vh] w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {withCoords.map((p) => {
            const base = p.etablissement.categorie === "hotel" ? "hotels" : "restos";
            return (
              <Marker key={p.id} position={[p.etablissement.lat as number, p.etablissement.lng as number]} icon={pin(p.is_favorite)}>
                <Popup>
                  <a href={`/${locale}/${base}/${p.etablissement.id}`} className="font-semibold text-accent">{p.etablissement.nom}</a>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
      {sansLoc > 0 && <p className="text-sm text-muted">{t("sansLocalisation", { n: sansLoc })}</p>}
    </div>
  );
}
