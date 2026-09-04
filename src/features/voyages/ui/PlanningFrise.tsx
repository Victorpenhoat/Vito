import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import {
  fenetreDepuis, barrePour, periodesDeLaFenetre, vacancesDuVoyage, type Periode,
} from "../domain/planning";

const MOIS_AFFICHES = 12;

type VoyageFrise = { id: string; titre: string; debut: string | null; fin: string | null };

// Frise du planning (Lot E). Une ligne par voyage, une bande pour les vacances
// scolaires : ce qu'on cherche, c'est autant les chevauchements que les
// créneaux libres. La frise défile horizontalement plutôt que de comprimer
// douze mois dans une largeur de téléphone.
export async function PlanningFrise({ voyages, vacances, aujourdhui }: {
  voyages: VoyageFrise[];
  vacances: Periode[];
  /** « YYYY-MM-DD » calculé au rendu serveur : le domaine ne lit pas l'horloge. */
  aujourdhui: string;
}) {
  const t = await getTranslations("voyages.planning");
  const format = await getFormatter();

  const fenetre = fenetreDepuis(new Date(`${aujourdhui}T00:00:00Z`), MOIS_AFFICHES);
  const periodes = periodesDeLaFenetre(vacances, fenetre);
  const dates = voyages.filter((v) => v.debut);
  const marqueurAujourdhui = barrePour(aujourdhui, aujourdhui, fenetre);

  const moisCourt = (annee: number, mois: number) =>
    format.dateTime(new Date(Date.UTC(annee, mois - 1, 1)), { month: "short", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-3">
      {vacances.length === 0 && (
        // Une frise vide de vacances laisserait croire qu'il n'y en a pas :
        // mieux vaut dire que le calendrier n'est pas encore renseigné.
        <p data-testid="planning-sans-vacances" className="rounded-card border border-current/20 bg-kpi-amber-bg px-3.5 py-2.5 text-[12.5px] text-ink">
          {t("calendrierAbsent")}
        </p>
      )}

      <div data-testid="planning-frise" className="overflow-x-auto">
        <div className="min-w-[860px]">
          {/* En-tête des mois */}
          <div className="grid grid-cols-12 border-b border-line pb-1">
            {fenetre.mois.map((m) => (
              <span key={`${m.annee}-${m.mois}`} data-testid="planning-mois"
                className="text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
                {moisCourt(m.annee, m.mois)}
              </span>
            ))}
          </div>

          {/* Bande des vacances scolaires */}
          <div className="relative mt-2 h-6 rounded-[4px] bg-surface-hover">
            {periodes.map((p) => {
              const barre = barrePour(p.debut, p.fin, fenetre);
              if (!barre) return null;
              return (
                <span key={p.id} data-testid="planning-vacances" title={p.libelle}
                  className="absolute inset-y-0 rounded-[4px] bg-kpi-amber/25"
                  style={{ left: `${barre.gauchePct}%`, width: `${barre.largeurPct}%` }}>
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center truncate px-1 text-[10px] font-semibold text-kpi-amber">
                    {p.libelle}
                  </span>
                </span>
              );
            })}
            {marqueurAujourdhui && (
              <span data-testid="planning-aujourdhui" aria-hidden
                className="absolute inset-y-[-4px] w-px bg-accent"
                style={{ left: `${marqueurAujourdhui.gauchePct}%` }} />
            )}
          </div>

          {/* Une ligne par voyage daté */}
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {dates.map((v) => {
              const barre = barrePour(v.debut, v.fin, fenetre);
              const pendant = vacancesDuVoyage({ debut: v.debut, fin: v.fin }, vacances);
              return (
                <li key={v.id} data-testid="planning-voyage" className="relative h-8 rounded-[4px] bg-surface-hover">
                  {barre ? (
                    <Link href={`/voyages/${v.id}`}
                      className="absolute inset-y-0 flex items-center overflow-hidden rounded-[4px] bg-accent px-2 text-[11.5px] font-semibold text-white hover:bg-accent-hover"
                      style={{ left: `${barre.gauchePct}%`, width: `${barre.largeurPct}%`, minWidth: "1.25rem" }}>
                      <span className="truncate">{v.titre}</span>
                    </Link>
                  ) : (
                    // Hors fenêtre : le voyage existe, il n'est simplement pas
                    // dans les douze mois affichés — on le dit plutôt que de
                    // laisser une ligne vide inexplicable.
                    <span className="absolute inset-y-0 left-0 flex items-center px-2 text-[11.5px] text-faint">
                      {t("horsFenetre", { titre: v.titre })}
                    </span>
                  )}
                  {pendant.length > 0 && (
                    <span data-testid="planning-pendant-vacances"
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-kpi-amber-bg px-2 py-0.5 text-[10px] font-semibold text-kpi-amber">
                      {t("pendantVacances", { libelle: pendant.map((p) => p.libelle).join(", ") })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {dates.length === 0 && (
        <p data-testid="planning-vide" className="text-[12.5px] text-muted">{t("aucunVoyageDate")}</p>
      )}
    </div>
  );
}
