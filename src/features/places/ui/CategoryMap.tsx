"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import { useTranslations } from "next-intl";
import { LocateFixed } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { mapCenter } from "../domain/mapCenter";
import {
  creerRegroupeur, dansLesLimites, bornesDesPoints,
  type Groupe, type Limites, type PointCarte,
} from "../domain/clusters";
import type { Place } from "../domain/filterPlaces";
import { CATEGORY_UI, type CategorieUi } from "../domain/categoryUiConfig";
import { restoStatut, type RestoStatut } from "@/features/restos/domain/statut";

// Carte v2 (design Onglet_Resto_v2, écran 5) : marqueurs distincts par statut
// (pin accent favori / triangle ambre à tester / carré gris testé), fiche
// compacte au tap, « Autour de moi ». Brique générique Restos/Hôtels : les
// hôtels s'éparpillent sur plusieurs pays et regroupent leurs marqueurs quand
// on dézoome (lot H5), les restos tiennent dans une ville et n'en ont pas
// besoin — c'est `map.clusters` de la config qui tranche.

function pinHtml(statut: RestoStatut, surbrillance: boolean): string {
  const scale = surbrillance ? "transform:scale(1.3);transform-origin:bottom center;" : "";
  if (statut === "favori") {
    return `<svg width="26" height="33" viewBox="0 0 30 38" style="filter:drop-shadow(0 3px 5px rgba(33,30,26,.35));${scale}"><path d="M15 1C7.8 1 2 6.8 2 14c0 9 13 23 13 23s13-14 13-23C28 6.8 22.2 1 15 1Z" fill="var(--accent)"/><circle cx="15" cy="13.5" r="4" fill="#fff"/></svg>`;
  }
  if (statut === "a_tester") {
    return `<svg width="26" height="31" viewBox="0 0 30 34" style="filter:drop-shadow(0 3px 5px rgba(33,30,26,.35));${scale}"><path d="M15 2 27 23.5c1 1.9-.4 4.5-2.6 4.5H5.6C3.4 28 2 25.4 3 23.5L15 2Z" fill="var(--kpi-amber)"/><circle cx="15" cy="21" r="3.2" fill="#fff"/></svg>`;
  }
  return `<svg width="20" height="20" viewBox="0 0 24 24" style="filter:drop-shadow(0 2px 4px rgba(33,30,26,.3));opacity:.85;${scale}"><rect x="3" y="3" width="18" height="18" rx="4" fill="#8F867A"/><path d="m8 12.5 3 3 5.5-6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Pastille d'un groupe : son compte, et la ville dominante quand on la connaît. */
function pastille(groupe: Groupe): L.DivIcon {
  const large = groupe.ville != null;
  const largeur = large ? Math.max(64, 30 + groupe.ville!.length * 7) : 34;
  const libelle = large
    ? `<span style="font:600 11px/1 ui-sans-serif,system-ui;white-space:nowrap">${escapeHtml(groupe.ville!)}</span>`
    : "";
  return L.divIcon({
    className: "",
    html:
      `<div data-testid="cluster-pastille" data-nb="${groupe.nb}" ` +
      `style="display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 ${large ? 9 : 0}px;` +
      `border-radius:999px;background:var(--accent);color:#fff;border:2px solid #fff;` +
      `box-shadow:0 3px 6px rgba(33,30,26,.35);justify-content:center;">` +
      `<span style="font:700 13px/1 ui-sans-serif,system-ui">${groupe.nb}</span>${libelle}</div>`,
    iconSize: [largeur, 30],
    iconAnchor: [largeur / 2, 15],
  });
}

/** Les noms de villes viennent de la base : ils entrent dans du HTML de marqueur. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function pin(statut: RestoStatut, surbrillance: boolean): L.DivIcon {
  const size = statut === "teste" ? 20 : 26;
  const height = statut === "favori" ? 33 : statut === "a_tester" ? 31 : 20;
  return L.divIcon({
    className: "",
    html: pinHtml(statut, surbrillance),
    iconSize: [size, height],
    iconAnchor: statut === "teste" ? [size / 2, size / 2] : [size / 2, height],
  });
}

/**
 * Les marqueurs, et le cadrage qui les commande. Vit DANS la carte : seul un
 * enfant de MapContainer peut écouter les déplacements et le zoom.
 *
 * Le cadrage est aussi remonté au parent (`onZone`), pour que le compteur et la
 * liste desktop décrivent ce qu'on regarde et non tout le carnet.
 */
function Marqueurs({ places, clusters, surbrillanceId, onSelect, onZone }: {
  places: Place[];
  clusters: boolean;
  surbrillanceId?: string | null;
  onSelect: (p: Place) => void;
  onZone?: (ids: string[]) => void;
}) {
  const map = useMap();
  const lireVue = (): { limites: Limites; zoom: number } => {
    const b = map.getBounds();
    return {
      limites: { ouest: b.getWest(), sud: b.getSouth(), est: b.getEast(), nord: b.getNorth() },
      zoom: map.getZoom(),
    };
  };
  const [vue, setVue] = useState(lireVue);
  useMapEvents({ moveend: () => setVue(lireVue()), zoomend: () => setVue(lireVue()) });

  const points: PointCarte[] = useMemo(
    () => places.map((p) => ({
      id: p.id,
      lat: p.etablissement.lat as number,
      lng: p.etablissement.lng as number,
      ville: p.etablissement.ville,
    })),
    [places],
  );
  const regroupeur = useMemo(() => creerRegroupeur(points), [points]);
  const { groupes, isoles } = useMemo(
    () => (clusters ? regroupeur.groupes(vue.limites, vue.zoom) : { groupes: [], isoles: points.map((p) => p.id) }),
    [clusters, regroupeur, vue, points],
  );

  // Le parent ne doit être averti que lorsque la zone CHANGE vraiment : un
  // nouveau tableau à chaque rendu le ferait boucler sur son propre état.
  const visibles = useMemo(() => dansLesLimites(points, vue.limites).join("|"), [points, vue]);
  const onZoneRef = useRef(onZone);
  useEffect(() => { onZoneRef.current = onZone; });
  useEffect(() => {
    onZoneRef.current?.(visibles ? visibles.split("|") : []);
  }, [visibles]);

  // Cadrage d'ouverture : englober TOUS les points plutôt que se poser sur leur
  // moyenne. Un carnet Paris + Lyon a sa moyenne en pleine Bourgogne — la carte
  // ouvrait alors sur un cadrage vide. Vrai des deux côtés : découvert sur les
  // hôtels (lot H5), le défaut guettait les restos dès qu'un carnet s'étale sur
  // deux villes. Plafonné au zoom d'ouverture historique (12) : la carte ne
  // s'approche jamais plus qu'avant.
  const signature = points.map((p) => p.id).join("|");
  useEffect(() => {
    const bornes = bornesDesPoints(points);
    if (!bornes) return;
    map.fitBounds(
      L.latLngBounds([bornes.sud, bornes.ouest], [bornes.nord, bornes.est]),
      { padding: [40, 40], maxZoom: 12 },
    );
    // points est reconstruit à chaque rendu : c'est sa SIGNATURE qui commande
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map]);

  const parId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  return (
    <>
      {groupes.map((g) => (
        <Marker key={g.cle} position={[g.lat, g.lng]} icon={pastille(g)}
          eventHandlers={{ click: () => {
            const zoom = regroupeur.zoomEclatement(g.cle);
            if (zoom != null) map.setView([g.lat, g.lng], Math.min(zoom, 18));
          } }} />
      ))}
      {isoles.map((id) => {
        const p = parId.get(id);
        if (!p) return null;
        return (
          <Marker key={p.id} position={[p.etablissement.lat as number, p.etablissement.lng as number]}
            icon={pin(restoStatut(p), surbrillanceId === p.id)}
            eventHandlers={{ click: () => onSelect(p) }} />
        );
      })}
    </>
  );
}

function AutourDeMoi({ label }: { label: string }) {
  const map = useMap();
  return (
    <button
      type="button"
      data-testid="autour-de-moi"
      onClick={() =>
        navigator.geolocation?.getCurrentPosition((p) => map.setView([p.coords.latitude, p.coords.longitude], 14))
      }
      className="absolute bottom-4 right-3 z-[1000] inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2.5 text-xs font-semibold text-ink shadow-[0_4px_12px_rgba(33,30,26,.15)] focus-visible:outline-2 focus-visible:outline-accent"
    >
      <LocateFixed size={13} className="text-accent" aria-hidden />
      {label}
    </button>
  );
}

export function CategoryMap({ places, surbrillanceId, categorie = "resto", onZone }: {
  places: Place[]; surbrillanceId?: string | null; categorie?: CategorieUi;
  /** Ids des adresses visibles dans le cadrage courant (hôtels : compteur et liste). */
  onZone?: (ids: string[]) => void;
}) {
  const config = CATEGORY_UI[categorie];
  const t = useTranslations("places");
  const tr = useTranslations(config.ns);
  const [selection, setSelection] = useState<Place | null>(null);

  const withCoords = places.filter((p) => p.etablissement.lat != null && p.etablissement.lng != null);
  const sansLoc = places.length - withCoords.length;
  const center = mapCenter(places);

  return (
    <div className="flex flex-col gap-2">
      <div data-testid="places-map" className="relative overflow-hidden rounded-card border border-line">
        <MapContainer center={[center.lat, center.lng]} zoom={12} scrollWheelZoom className="h-[60vh] w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marqueurs places={withCoords} clusters={config.map.clusters} surbrillanceId={surbrillanceId}
            onSelect={setSelection} onZone={onZone} />
          <AutourDeMoi label={tr("carte.autourDeMoi")} />
        </MapContainer>

        {/* fiche compacte du marqueur sélectionné */}
        {selection && (
          <div data-testid="marqueur-fiche" className="absolute inset-x-3 bottom-3 z-[1000] flex gap-3 rounded-[8px] border border-line bg-surface p-3 shadow-[0_10px_30px_rgba(33,30,26,.22)]">
            {selection.etablissement.photo_ref && (
              // eslint-disable-next-line @next/next/no-img-element -- proxy privé no-store
              <img src={`/api/places/photo?ref=${encodeURIComponent(selection.etablissement.photo_ref)}&w=200`}
                alt="" className="h-[54px] w-[54px] shrink-0 rounded-[5px] object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-serif text-base text-ink">{selection.etablissement.nom}</span>
                <StatutChipLecture statut={restoStatut(selection)} tr={tr} />
              </div>
              <div className="truncate text-[11.5px] text-faint">
                {[selection.etablissement.type, selection.etablissement.ville].filter(Boolean).join(" · ")}
              </div>
              <div className="mt-1 flex gap-3">
                <Link href={`${config.basePath}/${selection.etablissement.id}`} className="text-xs font-semibold text-accent hover:underline">
                  {tr("carte.ouvrirFiche")}
                </Link>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selection.etablissement.lat},${selection.etablissement.lng}`}
                  target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent hover:underline"
                >
                  {tr("carte.itineraire")} ↗
                </a>
              </div>
            </div>
            <button type="button" aria-label={tr("carte.fermer")} onClick={() => setSelection(null)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-line text-muted focus-visible:outline-2 focus-visible:outline-accent">
              ✕
            </button>
          </div>
        )}
      </div>
      {sansLoc > 0 && <p className="text-sm text-muted">{t("sansLocalisation", { n: sansLoc })}</p>}
    </div>
  );
}

function StatutChipLecture({ statut, tr }: { statut: RestoStatut; tr: ReturnType<typeof useTranslations> }) {
  const tone =
    statut === "favori" ? "border-accent/25 bg-accent-50 text-accent"
    : statut === "a_tester" ? "border-current/20 bg-kpi-amber-bg text-kpi-amber"
    : "border-line bg-surface-hover text-muted";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${tone}`}>
      {statut === "favori" ? "♥ " : ""}{tr(`statut.${statut}`)}
    </span>
  );
}
