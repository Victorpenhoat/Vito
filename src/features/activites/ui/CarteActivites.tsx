"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { useTranslations } from "next-intl";
import { LocateFixed } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { positionActuelle } from "@/lib/platform/position";
import { bornesDesPoints } from "@/features/places/domain/clusters";

export type PointActivite = {
  id: string;
  nom: string;
  clubNom: string | null;
  adresse: string | null;
  lat: number;
  lng: number;
  statut: string;
  membres: { id: string; prenom: string; couleur: string | null }[];
};

/**
 * Une épingle par activité, à la COULEUR DE SON MEMBRE — c'est ce qui permet de
 * lire la carte d'un coup d'œil : le bleu, c'est Alexia.
 *
 * Une activité en pause garde sa place mais perd sa couleur : elle est au
 * carnet, pas à l'agenda.
 */
function epingle(couleur: string, enPause: boolean) {
  return L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:26px;height:26px;border-radius:50%;
      background:${enPause ? "var(--surface)" : couleur};border:2px solid ${couleur};
      box-shadow:0 2px 6px var(--color-shadow);"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/** Cadre la carte sur ce qu'il y a à voir — pas sur la moyenne des points. */
function Cadrage({ points }: { points: PointActivite[] }) {
  const map = useMap();
  const bornes = bornesDesPoints(points.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, ville: null })));
  const [fait, setFait] = useState(false);
  if (!fait && bornes) {
    setFait(true);
    // La moyenne de Paris et Lyon tombe en Bourgogne : on cadre sur les bornes,
    // en bornant le zoom pour ne pas coller à un point unique.
    map.fitBounds([[bornes.sud, bornes.ouest], [bornes.nord, bornes.est]], {
      padding: [40, 40], maxZoom: 13,
    });
  }
  return null;
}

function AutourDeMoi({ label }: { label: string }) {
  const map = useMap();
  return (
    <button type="button" data-testid="carte-autour-de-moi"
      onClick={async () => {
        const pos = await positionActuelle();
        if (pos) map.setView([pos.lat, pos.lng], 13);
      }}
      className="absolute bottom-4 right-3 z-[1000] inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2.5 text-xs font-semibold text-ink shadow-[0_4px_12px_var(--color-shadow)] focus-visible:outline-2 focus-visible:outline-accent">
      <LocateFixed size={13} className="text-accent" aria-hidden />
      {label}
    </button>
  );
}

export function CarteActivites({ points, sansAdresse }: {
  points: PointActivite[];
  /** Combien d'activités n'ont pas d'adresse : elles ne sont nulle part. */
  sansAdresse: number;
}) {
  const t = useTranslations("activites");
  const [choisie, setChoisie] = useState<PointActivite | null>(null);
  const premier = points[0];

  if (!premier) {
    return (
      <p data-testid="carte-vide" className="rounded-card border border-dashed border-line bg-surface px-6 py-10 text-center text-[13px] text-muted">
        {t("vide.carteTexte")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div data-testid="carte-activites" className="relative overflow-hidden rounded-card border border-line">
        <MapContainer center={[premier.lat, premier.lng]} zoom={12} scrollWheelZoom className="h-[60vh] w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Cadrage points={points} />
          {points.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={epingle(p.membres[0]?.couleur ?? "var(--accent)", p.statut !== "en_cours")}
              eventHandlers={{ click: () => setChoisie(p) }}
            />
          ))}
          <AutourDeMoi label={t("carte.autourDeMoi")} />
        </MapContainer>

        {choisie && (
          <div data-testid="carte-fiche" className="absolute inset-x-3 bottom-3 z-[1000] flex flex-col gap-1 rounded-[8px] border border-line bg-surface p-3 shadow-[0_10px_30px_var(--color-shadow)]">
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-serif text-base text-ink">{choisie.nom}</span>
              {choisie.membres.map((m) => (
                <span key={m.id} aria-hidden
                  className="grid h-5 w-5 place-items-center rounded-full text-[9.5px] font-semibold text-white"
                  style={{ background: m.couleur ?? "var(--line)" }}>
                  {m.prenom.slice(0, 1).toUpperCase()}
                </span>
              ))}
            </span>
            <span className="truncate text-[11.5px] text-faint">
              {[choisie.clubNom, choisie.adresse].filter(Boolean).join(" · ")}
            </span>
            <span className="mt-0.5 flex gap-3">
              <Link href={`/activites/${choisie.id}`} className="text-xs font-semibold text-accent hover:underline">
                {t("carte.ouvrirFiche")}
              </Link>
              {choisie.adresse && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(choisie.adresse)}`}
                  target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent hover:underline">
                  {t("itineraire")} ↗
                </a>
              )}
            </span>
          </div>
        )}
      </div>
      {sansAdresse > 0 && (
        // Le dire plutôt que de laisser croire que la carte montre tout.
        <p data-testid="carte-sans-adresse" className="text-[11.5px] text-muted">
          {t("carte.sansAdresse", { n: sansAdresse })}
        </p>
      )}
    </div>
  );
}
