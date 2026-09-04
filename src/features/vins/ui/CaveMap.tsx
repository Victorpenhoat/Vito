"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { useTranslations } from "next-intl";
import { LocateFixed } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { centreLieux, type LieuCarte } from "../domain/caveCarte";
import { VerresLecture } from "./NoteVerres";

// Carte de la Cave (design Vins & Cave écran 6). Les marqueurs des restos
// portent le NOMBRE de dégustations : ici, ce qui compte n'est pas le statut du
// lieu mais combien de fois j'y ai bu.

function pastille(nb: number, actif: boolean): L.DivIcon {
  const taille = nb > 9 ? 34 : 30;
  return L.divIcon({
    className: "",
    html:
      `<div style="width:${taille}px;height:${taille}px;border-radius:999px;background:var(--accent);color:#fff;` +
      `display:grid;place-items:center;font:600 13px/1 ui-sans-serif,system-ui;border:2px solid #fff;` +
      `box-shadow:0 3px 6px rgba(33,30,26,.35);${actif ? "transform:scale(1.15);" : ""}">${nb}</div>`,
    iconSize: [taille, taille],
    iconAnchor: [taille / 2, taille / 2],
  });
}

function AutourDeMoi({ label }: { label: string }) {
  const map = useMap();
  return (
    <button
      type="button"
      data-testid="cave-autour-de-moi"
      onClick={() =>
        navigator.geolocation?.getCurrentPosition((p) => map.setView([p.coords.latitude, p.coords.longitude], 13))
      }
      className="absolute bottom-4 right-3 z-[1000] inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2.5 text-xs font-semibold text-ink shadow-[0_4px_12px_rgba(33,30,26,.15)] focus-visible:outline-2 focus-visible:outline-accent"
    >
      <LocateFixed size={13} className="text-accent" aria-hidden />
      {label}
    </button>
  );
}

export function CaveMap({ lieux }: { lieux: LieuCarte[] }) {
  const t = useTranslations("vins");
  const [selection, setSelection] = useState<LieuCarte | null>(null);
  const centre = centreLieux(lieux);

  return (
    <div data-testid="cave-map" className="relative overflow-hidden rounded-card border border-line">
      <MapContainer center={[centre.lat, centre.lng]} zoom={12} scrollWheelZoom className="h-[55vh] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {lieux.map((l) => (
          <Marker
            key={l.id}
            position={[l.lat, l.lng]}
            icon={pastille(l.nb, selection?.id === l.id)}
            eventHandlers={{ click: () => setSelection(l) }}
          />
        ))}
        <AutourDeMoi label={t("carte.autourDeMoi")} />
      </MapContainer>

      {selection && (
        <div data-testid="cave-marqueur-fiche"
          className="absolute inset-x-3 bottom-3 z-[1000] flex items-start gap-3 rounded-[8px] border border-line bg-surface p-3 shadow-[0_10px_30px_rgba(33,30,26,.22)]">
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif text-base text-ink">{selection.nom}</div>
            <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-faint">
              <span>{t("nDegustations", { n: selection.nb })}</span>
              {selection.note_moyenne != null && <VerresLecture note={selection.note_moyenne} />}
            </div>
            <Link href={`/restos/${selection.id}`} className="mt-1 inline-block text-xs font-semibold text-accent hover:underline">
              {t("carte.ficheResto")} →
            </Link>
          </div>
          <button type="button" aria-label={t("carte.fermer")} onClick={() => setSelection(null)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-line text-muted focus-visible:outline-2 focus-visible:outline-accent">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
