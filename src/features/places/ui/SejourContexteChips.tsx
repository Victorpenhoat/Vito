"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarDays, Users } from "lucide-react";
import {
  grilleMois, moisAPartirDe, nuits, plageApresClic, type SejourContexte,
} from "../domain/sejourContexte";
import { Button } from "@/features/shared/ui/Button";

// Dates + occupation de la recherche d'hébergement (design Hôtels v2 écrans 7
// et 8). Rien de tout cela ne part chez le fournisseur : Google Places New
// n'accepte ni dates ni occupation. Ce qui est choisi ici prérempli le
// formulaire « J'y ai séjourné » — c'est tout son office, et c'est écrit à
// l'écran pour que personne n'attende un filtrage de disponibilité.

const MOIS_AFFICHES = 3;
const JOURS_SEMAINE = ["l", "m", "me", "j", "v", "s", "d"] as const;

export function SejourContexteChips({ contexte, onChange }: {
  contexte: SejourContexte;
  onChange: (suivant: SejourContexte) => void;
}) {
  const t = useTranslations("hotels");
  const format = useFormatter();
  const [ouvert, setOuvert] = useState<"dates" | "occupation" | null>(null);
  const [brouillon, setBrouillon] = useState<SejourContexte>(contexte);

  const ouvrir = (quoi: "dates" | "occupation") => {
    setBrouillon(contexte);
    setOuvert((v) => (v === quoi ? null : quoi));
  };

  const appliquer = () => {
    onChange(brouillon);
    setOuvert(null);
  };

  const jourCourt = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });

  const libelleDates = contexte.arrivee
    ? contexte.depart
      ? `${jourCourt(contexte.arrivee)} – ${jourCourt(contexte.depart)}`
      : jourCourt(contexte.arrivee)
    : t("recherche.dates");

  const libelleOccupation = t("recherche.occupationCourte", {
    adultes: contexte.adultes, enfants: contexte.enfants, chambres: contexte.chambres,
  });

  const chipCls = (actif: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
      actif ? "border border-accent/30 bg-accent-50 font-semibold text-accent" : "border border-line bg-surface-hover text-muted"
    }`;

  return (
    <div data-testid="sejour-contexte" className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" data-testid="chip-dates" aria-expanded={ouvert === "dates"}
          className={chipCls(contexte.arrivee != null)} onClick={() => ouvrir("dates")}>
          <CalendarDays size={11} aria-hidden />
          {libelleDates} ▾
        </button>
        <button type="button" data-testid="chip-occupation" aria-expanded={ouvert === "occupation"}
          className={chipCls(false)} onClick={() => ouvrir("occupation")}>
          <Users size={11} aria-hidden />
          {libelleOccupation} ▾
        </button>
      </div>

      {ouvert && (
        <div data-testid="sejour-contexte-feuille" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-3">
          {ouvert === "dates" ? (
            <Calendrier plage={brouillon} onJour={(jour) => setBrouillon((b) => ({ ...b, ...plageApresClic(b, jour) }))}
              onSansDates={() => setBrouillon((b) => ({ ...b, arrivee: null, depart: null }))} />
          ) : (
            <Occupation contexte={brouillon} onChange={setBrouillon} />
          )}

          <Button type="button" data-testid="contexte-appliquer" onClick={appliquer}>
            {t("recherche.appliquer")}
          </Button>
          {/* Le fournisseur ne sait rien des dates : le dire ici évite d'attendre
              un filtrage de disponibilité qui n'existe pas. */}
          <p className="text-center text-[10.5px] text-faint">{t("recherche.contexteOptionnel")}</p>
        </div>
      )}
    </div>
  );
}

function Calendrier({ plage, onJour, onSansDates }: {
  plage: { arrivee: string | null; depart: string | null };
  onJour: (jour: string) => void;
  onSansDates: () => void;
}) {
  const t = useTranslations("hotels");
  const format = useFormatter();
  // Le premier rendu du calendrier n'a lieu qu'après ouverture, donc côté
  // client : « aujourd'hui » ne peut pas désynchroniser une hydratation.
  const [mois] = useState(() => moisAPartirDe(new Date(), MOIS_AFFICHES));
  const n = nuits(plage);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{t("recherche.datesTitre")}</span>
        <button type="button" data-testid="sans-dates" onClick={onSansDates}
          className="text-[11px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
          {t("recherche.sansDates")}
        </button>
      </div>

      <div className="flex max-h-[46vh] flex-col gap-4 overflow-y-auto">
        {mois.map(({ annee, mois: m }) => (
          <div key={`${annee}-${m}`} className="flex flex-col gap-1">
            <div className="text-[12px] font-semibold text-ink">
              {format.dateTime(new Date(Date.UTC(annee, m - 1, 1)), { month: "long", year: "numeric", timeZone: "UTC" })}
            </div>
            <div className="grid grid-cols-7 text-center text-[9.5px] uppercase text-faint">
              {JOURS_SEMAINE.map((j, i) => <span key={i}>{t(`recherche.jours.${j}`)}</span>)}
            </div>
            {grilleMois(annee, m).map((semaine, i) => (
              <div key={i} className="grid grid-cols-7 gap-0.5">
                {semaine.map((jour, k) => {
                  if (!jour) return <span key={k} />;
                  const arrivee = jour === plage.arrivee;
                  const depart = jour === plage.depart;
                  const dedans = plage.arrivee != null && plage.depart != null && jour > plage.arrivee && jour < plage.depart;
                  return (
                    <button key={k} type="button" data-testid={`jour-${jour}`} onClick={() => onJour(jour)}
                      aria-pressed={arrivee || depart}
                      className={`rounded-[6px] py-1.5 text-[12px] focus-visible:outline-2 focus-visible:outline-accent ${
                        arrivee || depart ? "bg-accent font-semibold text-white"
                        : dedans ? "bg-accent-50 text-accent" : "text-ink hover:bg-surface-hover"
                      }`}>
                      {Number(jour.slice(8))}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p data-testid="contexte-nuits" className="text-[11.5px] text-muted">
        {n == null ? t("recherche.aucuneDate") : t("recherche.nuits", { n })}
      </p>
    </div>
  );
}

function Occupation({ contexte, onChange }: {
  contexte: SejourContexte;
  onChange: (suivant: SejourContexte) => void;
}) {
  const t = useTranslations("hotels");
  // Pas d'âge des enfants : la base ne stocke qu'un nombre (00032), et aucun
  // fournisseur ne les reçoit — ce serait une saisie sans destinataire.
  const champs = [
    { cle: "adultes", min: 1, max: 20 },
    { cle: "enfants", min: 0, max: 20 },
    { cle: "chambres", min: 1, max: 10 },
  ] as const;

  return (
    <div className="flex flex-col gap-2">
      {champs.map(({ cle, min, max }) => (
        <div key={cle} className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-ink">{t(`visite.${cle}`)}</span>
          <span className="flex items-center gap-3">
            <Pas label={t("recherche.moins")} testId={`${cle}-moins`} disabled={contexte[cle] <= min}
              onClick={() => onChange({ ...contexte, [cle]: Math.max(min, contexte[cle] - 1) })}>−</Pas>
            <span data-testid={`compte-${cle}`} className="w-5 text-center text-sm tabular-nums text-ink">{contexte[cle]}</span>
            <Pas label={t("recherche.plus")} testId={`${cle}-plus`} disabled={contexte[cle] >= max}
              onClick={() => onChange({ ...contexte, [cle]: Math.min(max, contexte[cle] + 1) })}>+</Pas>
          </span>
        </div>
      ))}
    </div>
  );
}

function Pas({ label, testId, disabled, onClick, children }: {
  label: string; testId: string; disabled: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" data-testid={testId} aria-label={label} disabled={disabled} onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-full border border-line bg-surface text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-35">
      {children}
    </button>
  );
}
