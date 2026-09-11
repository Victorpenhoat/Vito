"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { voyageChip } from "../domain/affichageVoyage";
import { chevauche, type Periode } from "../domain/planning";
import {
  grilleDuMois, voyagesDeLaSemaine, periodesEtLeursVoyages, moisVoisin,
  type VoyagePlanning,
} from "../domain/planningCalendaire";


type Vue = "semaine" | "mois" | "annee";
type Voyage = VoyagePlanning & { participants: number };

// Planning (maquette « Planning Mois » et « Web — Planning global ») : un vrai
// calendrier, les voyages inscrits sous la semaine qu'ils traversent, et un
// panneau d'année scolaire qui dit ce qui est prévu — ou qu'une période est
// libre. C'est cette dernière idée qui fait le sel de l'écran : on y vient
// autant pour voir ce qui reste à remplir que ce qui est déjà pris.
export function PlanningCalendrier({
  voyages, vacances, aujourdhui, zone, autresZones = [], vueAnnee, creneaux = [],
}: {
  voyages: Voyage[];
  vacances: Periode[];
  /** « YYYY-MM-DD » calculé au rendu serveur : le domaine ne lit pas l'horloge. */
  aujourdhui: string;
  /** Zone du foyer annoncée dans l'en-tête, ou `null` si elle reste à choisir. */
  zone: string | null;
  /** Les zones voisines, quand on a demandé à les voir. */
  autresZones?: { zone: string; periodes: Periode[] }[];
  /** La frise de douze mois, rendue par le SERVEUR et passée en nœud : un
   *  composant serveur ne s'invoque pas depuis un composant client. */
  vueAnnee: React.ReactNode;
  /** Créneaux d'activités : un repère sous les jours où la famille a cours.
   *  Leur règle est récurrente et PURE, donc calculable ici sans requête à
   *  chaque changement de mois. */
  creneaux?: { jourSemaine: number; valideDu: string | null; valideAu: string | null }[];
}) {
  const t = useTranslations("voyages.planning");
  const format = useFormatter();
  const [vue, setVue] = useState<Vue>("mois");
  const [curseur, setCurseur] = useState(() => ({
    annee: Number(aujourdhui.slice(0, 4)),
    mois: Number(aujourdhui.slice(5, 7)),
  }));

  const grille = grilleDuMois(curseur.annee, curseur.mois);
  // La vue Semaine montre la semaine du jour, prise dans la même grille : une
  // seule mécanique de calcul, donc aucun risque de divergence entre les vues.
  const semaineDuJour = grille.find((s) => s.some((j) => j.jour === aujourdhui)) ?? grille[0] ?? [];
  const semaines = vue === "semaine" ? [semaineDuJour] : grille;

  const dansVacances = (jour: string) =>
    vacances.some((p) => chevauche({ debut: jour, fin: jour }, p));

  /** Quelles zones voisines sont en vacances ce jour-là. */
  const autresEnVacances = (jour: string) =>
    autresZones.filter(({ periodes }) => periodes.some((p) => chevauche({ debut: jour, fin: jour }, p)));

  /** Y a-t-il cours ce jour-là ? Un point sous la date suffit à le dire. */
  const aCours = (jour: string) => {
    const j = ((new Date(`${jour}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    return creneaux.some((c) =>
      c.jourSemaine === j
      && !(c.valideDu && jour < c.valideDu)
      && !(c.valideAu && jour > c.valideAu));
  };

  const titreMois = format.dateTime(new Date(Date.UTC(curseur.annee, curseur.mois - 1, 1)), {
    month: "long", year: "numeric", timeZone: "UTC",
  });
  const jourCourt = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });

  const TEINTE: Record<string, string> = {
    a_venir: "border-accent/30 bg-accent-50 text-accent",
    en_cours: "border-kpi-green/30 bg-kpi-green-bg text-kpi-green",
    en_preparation: "border-current/20 bg-kpi-amber-bg text-kpi-amber",
    idees: "border-current/20 bg-kpi-amber-bg text-kpi-amber",
    termines: "border-line bg-surface-hover text-muted",
  };

  return (
    <div data-testid="planning-calendrier" className="flex flex-col gap-4">
      {/* en-tête : zone scolaire + bascules de vue */}
      <div className="flex flex-wrap items-center gap-2">
        {zone ? (
          <span data-testid="planning-zone"
            className="rounded-full border border-current/20 bg-kpi-amber-bg px-3 py-1 text-[11px] font-semibold text-kpi-amber">
            {t("zone", { zone })}
          </span>
        ) : (
          // Sans zone, aucune bande ne sera dessinée : le dire ICI, dans la vue
          // par défaut, plutôt que de laisser un calendrier muet qu'on prendrait
          // pour une panne.
          <Link href="/reglages" data-testid="planning-choisir-zone"
            className="rounded-full border border-current/20 bg-kpi-amber-bg px-3 py-1 text-[11px] font-semibold text-kpi-amber hover:underline">
            {t("choisirZone")}
          </Link>
        )}
        <div className="ml-auto flex gap-1 rounded-control border border-line p-0.5">
          {(["semaine", "mois", "annee"] as const).map((v) => (
            <button key={v} type="button" data-testid={`vue-${v}`} aria-pressed={vue === v}
              onClick={() => setVue(v)}
              className={`rounded-control px-3 py-1.5 text-[11.5px] font-semibold ${
                vue === v ? "bg-accent text-white" : "text-muted hover:text-ink"
              }`}>
              {t(`vues.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {vue === "annee" ? (
        // La frise de douze mois garde son utilité : c'est la vue « Année ».
        vueAnnee
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button type="button" data-testid="mois-precedent" aria-label={t("moisPrecedent")}
              onClick={() => setCurseur((c) => moisVoisin(c.annee, c.mois, -1))}
              className="grid h-7 w-7 place-items-center rounded-full border border-line text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
              <ChevronLeft size={14} aria-hidden />
            </button>
            <span data-testid="planning-mois-titre" className="font-serif text-lg text-ink first-letter:uppercase">{titreMois}</span>
            <button type="button" data-testid="mois-suivant" aria-label={t("moisSuivant")}
              onClick={() => setCurseur((c) => moisVoisin(c.annee, c.mois, 1))}
              className="grid h-7 w-7 place-items-center rounded-full border border-line text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
              <ChevronRight size={14} aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
            {["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((j) => <span key={j}>{t(`jours.${j}`)}</span>)}
          </div>

          {semaines.map((semaine, i) => (
            <div key={i} data-testid="planning-semaine" className="flex flex-col gap-1">
              <div className="grid grid-cols-7 gap-1">
                {semaine.map((j) => (
                  <span key={j.jour} data-testid={`jour-${j.jour}`}
                    className={`rounded-card py-2 text-center text-[12.5px] ${
                      j.horsMois ? "text-faint/50"
                      : j.jour === aujourdhui ? "bg-accent font-semibold text-white"
                      : dansVacances(j.jour) ? "bg-kpi-amber-bg text-kpi-amber"
                      : "text-ink"
                    }`}>
                    {j.numero}
                    {!j.horsMois && aCours(j.jour) && (
                      <span data-testid="jour-activite" aria-hidden
                        className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-accent" />
                    )}
                    {/* Les zones voisines : une pastille pâle, pas une bande —
                        la case appartient à la zone du foyer, les autres ne
                        font qu'y passer. Le libellé est dans l'infobulle : à
                        cette taille, une lettre serait illisible. */}
                    {!j.horsMois && autresZones.length > 0 && (
                      <span className="mt-0.5 flex justify-center gap-0.5">
                        {autresEnVacances(j.jour).map(({ zone: autre }) => (
                          <span key={autre} data-testid="pastille-zone-autre" title={autre}
                            className="h-1 w-1 rounded-full bg-kpi-amber/50" />
                        ))}
                      </span>
                    )}
                  </span>
                ))}
              </div>
              {/* Les voyages de la semaine, sous elle : une bande par voyage,
                  comme la maquette — plutôt qu'un point dans une case, illisible
                  dès qu'un séjour dure plus d'un jour. */}
              {voyagesDeLaSemaine(semaine, voyages).map((v) => {
                const etat = voyageChip(v.statut, v.debut, v.fin, aujourdhui);
                const complet = voyages.find((x) => x.id === v.id);
                return (
                  <Link key={v.id} href={`/voyages/${v.id}`} data-testid="planning-bande"
                    className={`flex items-center gap-2 rounded-card border px-2.5 py-1.5 text-[11.5px] font-semibold ${TEINTE[etat] ?? TEINTE.a_venir}`}>
                    <span className="truncate">{v.titre}</span>
                    <span className="ml-auto shrink-0 font-normal opacity-80">
                      {v.debut && v.fin ? `${jourCourt(v.debut)} → ${jourCourt(v.fin)}`
                        : v.debut ? jourCourt(v.debut) : t("datesAConfirmer")}
                      {complet && complet.participants > 0
                        ? ` · ${t("participants", { n: complet.participants })}` : ""}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}

          {/* légende */}
          <ul data-testid="planning-legende" className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted">
            {(["a_venir", "en_cours", "en_preparation"] as const).map((e) => (
              <li key={e} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-control border ${TEINTE[e]}`} aria-hidden />
                {t(`legende.${e}`)}
              </li>
            ))}
            {zone && (
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-control bg-kpi-amber-bg" aria-hidden />
                {t("legende.vacances", { zone })}
              </li>
            )}
            {autresZones.length > 0 && (
              <li className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-kpi-amber/50" aria-hidden />
                {t("legende.autresZones")}
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Panneau d'année scolaire : ce qui est prévu, et surtout ce qui est libre */}
      {vacances.length > 0 && (
        <section data-testid="planning-annee-scolaire" className="flex flex-col gap-1.5 rounded-card border border-line bg-surface p-3.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("anneeScolaire")}</h2>
          <ul className="flex flex-col">
            {periodesEtLeursVoyages(vacances, voyages).map(({ periode, voyages: dessus }) => (
              <li key={periode.id} data-testid="periode-scolaire"
                className="flex flex-wrap items-center gap-2 border-b border-line-soft py-2 last:border-b-0">
                <span className="text-[12.5px] font-medium text-ink">{periode.libelle}</span>
                <span className="text-[11.5px] text-muted">
                  {jourCourt(periode.debut)} → {jourCourt(periode.fin)}
                </span>
                {dessus.length > 0 ? (
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    {dessus.map((v) => (
                      <Link key={v.id} href={`/voyages/${v.id}`} data-testid="periode-voyage"
                        className="rounded-full border border-accent/25 bg-accent-50 px-2.5 py-0.5 text-[11px] font-semibold text-accent hover:underline">
                        {v.titre}
                      </Link>
                    ))}
                  </span>
                ) : (
                  // Le geste que la maquette met en avant : une période libre
                  // n'est pas un vide, c'est une invitation.
                  <Link href="/voyages#nouveau" data-testid="periode-libre"
                    className="ml-auto text-[11.5px] font-semibold text-accent hover:underline">
                    {t("creerIdee")} →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
