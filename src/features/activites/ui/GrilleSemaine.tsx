import { getTranslations, getFormatter } from "next-intl/server";
import { AlertTriangle, Plane, Sun } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import type { Occurrence } from "../domain/semaine";
import type { Periode } from "@/features/voyages/domain/planning";
import { placer, repartirColonnes, GRADUATIONS, RAIL_DEBUT, RAIL_FIN } from "../domain/grilleSemaine";

export type JourGrille = {
  jour: string;
  occurrences: Occurrence[];
  signaux: { vacances: Periode | null; voyage: { titre: string } | null };
  conflits: Set<string>;
};

/**
 * La semaine en SEPT COLONNES, sur grand écran (design « D · Cette semaine »).
 *
 * La liste par jour dit ce qui a lieu ; cette grille dit quand — et surtout ce
 * qui se chevauche, qu'une liste ne montre jamais vraiment. C'est la même
 * donnée, placée autrement : le domaine ne recalcule rien, il positionne.
 */
export async function GrilleSemaine({ jours, aujourdhui, zone }: {
  jours: JourGrille[];
  aujourdhui: string;
  /** Zone du foyer, ou `null` quand elle n'est ni choisie ni déductible. */
  zone: string | null;
}) {
  const t = await getTranslations("activites");
  const format = await getFormatter();
  const jourCourt = (j: string) =>
    format.dateTime(new Date(`${j}T00:00:00Z`), { weekday: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div data-testid="grille-semaine" className="hidden lg:flex lg:flex-col lg:gap-2">
      <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-1">
        {/* coin vide, au-dessus du rail horaire */}
        <span />
        {jours.map(({ jour, signaux, conflits }) => (
          <div key={jour}
            className={`flex flex-col gap-1 rounded-t-[6px] px-2 py-1.5 ${
              jour === aujourdhui ? "bg-accent-50" : ""
            }`}>
            <span className="text-[12px] font-semibold text-ink first-letter:uppercase">{jourCourt(jour)}</span>
            {/* Le signal du jour vit dans son en-tête : on lit la semaine en
                parcourant une seule ligne. */}
            <span className="flex flex-wrap gap-1">
              {conflits.size > 0 && (
                <span data-testid="colonne-conflit" className="inline-flex items-center gap-0.5 rounded-full border border-danger/30 bg-danger-bg px-1.5 py-0.5 text-[9.5px] font-semibold text-danger">
                  <AlertTriangle size={8} aria-hidden />
                  {t("semaine.conflitCourt")}
                </span>
              )}
              {signaux.voyage && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-accent/25 bg-accent-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-accent">
                  <Plane size={8} aria-hidden />
                  {signaux.voyage.titre}
                </span>
              )}
              {signaux.vacances && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-current/20 bg-kpi-amber-bg px-1.5 py-0.5 text-[9.5px] font-semibold text-kpi-amber">
                  <Sun size={8} aria-hidden />
                  {t("semaine.vacancesCourt")}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-1">
        {/* Rail horaire : les graduations portent la lecture, les traits la
            rendent comparable d'une colonne à l'autre. */}
        <div className="relative h-[520px]">
          {GRADUATIONS.map((h) => (
            <span key={h} className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-faint"
              style={{ top: `${((h - RAIL_DEBUT) / (RAIL_FIN - RAIL_DEBUT)) * 100}%` }}>
              {h}h
            </span>
          ))}
        </div>

        {jours.map(({ jour, occurrences, signaux, conflits }) => (
          <div key={jour} data-testid="grille-colonne"
            className={`relative h-[520px] rounded-[6px] border border-line ${
              jour === aujourdhui ? "bg-accent-50/40" : "bg-surface"
            }`}>
            {GRADUATIONS.slice(1, -1).map((h) => (
              <span key={h} aria-hidden className="absolute inset-x-0 border-t border-line-soft"
                style={{ top: `${((h - RAIL_DEBUT) / (RAIL_FIN - RAIL_DEBUT)) * 100}%` }} />
            ))}

            {repartirColonnes(occurrences).map(({ seance: o, rang, total }) => {
              const p = placer(o.heureDebut, o.heureFin);
              if (!p) return null;
              const enConflit = conflits.has(o.creneauId);
              return (
                <Link
                  key={o.creneauId}
                  href={`/activites/${o.activiteId}`}
                  data-testid="grille-seance"
                  style={{
                    top: `${p.hautPct}%`, height: `${p.hauteurPct}%`,
                    // Deux pixels de marge de part et d'autre : sans eux, la
                    // bordure déborde de la colonne quand deux séances se
                    // partagent la largeur.
                    left: `calc(${(rang / total) * 100}% + 2px)`,
                    width: `calc(${100 / total}% - 4px)`,
                  }}
                  className={`absolute flex flex-col overflow-hidden rounded-[4px] border px-1.5 py-1 text-[10.5px] leading-tight ${
                    enConflit
                      ? "border-danger/40 bg-danger-bg text-danger"
                      : signaux.voyage
                        ? "border-accent/30 bg-accent-50 text-accent"
                        : "border-line bg-surface-hover text-ink"
                  }`}
                >
                  <span className="truncate font-semibold">{o.activiteNom}</span>
                  <span className="truncate opacity-80">{o.heureDebut.replace(":", "h")}</span>
                  <span className="truncate opacity-80">
                    {o.deposePar
                      ? o.deposePar.prenom
                      : o.covoiturage
                        ? t("horaires.covoiturage")
                        : t("semaine.deposeCourt")}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Légende : les trois teintes de la grille, nommées une fois. */}
      <ul data-testid="grille-legende" className="flex flex-wrap gap-3 text-[11px] text-muted">
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-danger/40 bg-danger-bg" aria-hidden />
          {t("semaine.legende.conflit")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-accent/30 bg-accent-50" aria-hidden />
          {t("semaine.legende.voyage")}
        </li>
        {/* Sans zone, aucune case n'est teintée : la légende n'aurait rien à
            nommer. */}
        {zone && (
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-current/20 bg-kpi-amber-bg" aria-hidden />
            {t("semaine.legende.vacances", { zone })}
          </li>
        )}
      </ul>
    </div>
  );
}
