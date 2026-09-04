import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { couleurTint } from "../domain/couleurTint";
import type { CaveStats } from "../domain/caveStats";

// « Ma cave en chiffres » (design Vins & Cave écran 7). Les barres sont des
// div en pourcentage : ce projet n'embarque aucune bibliothèque de graphiques,
// et trois blocs de statistiques ne justifient pas d'en ajouter une.

export async function CaveStatsPanel({ stats }: { stats: CaveStats }) {
  const t = await getTranslations("vins");
  const format = await getFormatter();
  const euros = (n: number) => format.number(n, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  if (stats.nbDegustations === 0 && stats.nbVins === 0) {
    return (
      <div data-testid="cave-stats-vide" className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="font-serif text-lg text-ink">{t("stats.videTitre")}</p>
        <p className="max-w-xs text-[12.5px] text-muted">{t("cave.videTotal")}</p>
        <Link href="/restos?onglet=cave" className="text-sm font-semibold text-accent hover:underline">
          {t("stats.retour")}
        </Link>
      </div>
    );
  }

  const maxRegion = Math.max(...stats.regions.map((r) => r.nb), 1);
  const maxMois = Math.max(...stats.depense.mois.map((m) => m.montant), 1);

  return (
    <div data-testid="cave-stats" className="flex flex-col gap-7 lg:grid lg:grid-cols-2 lg:gap-8">
      <section className="lg:col-span-2">
        <div data-testid="cave-stats-tuiles" className="grid grid-cols-3 border-y border-line">
          <Tuile valeur={String(stats.nbVins)} label={t("stats.vins")} />
          <Tuile valeur={String(stats.nbDegustations)} label={t("stats.degustations")} borde />
          <Tuile valeur={stats.noteMoyenne == null ? "—" : format.number(stats.noteMoyenne)} label={t("stats.noteMoyenne")} borde />
        </div>
      </section>

      {stats.couleurs.length > 0 && (
        <Bloc titre={t("stats.parCouleur")} testId="stats-couleurs">
          <ul className="flex flex-col gap-2">
            {stats.couleurs.map((c) => (
              <li key={c.couleur} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-[12.5px] text-ink">{t(`couleurs.${c.couleur}`)}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                  <span className="block h-full rounded-full" style={{ width: `${c.part}%`, backgroundImage: couleurTint(c.couleur) }} />
                </span>
                <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-muted">{c.part} %</span>
              </li>
            ))}
          </ul>
        </Bloc>
      )}

      {stats.regions.length > 0 && (
        <Bloc titre={t("stats.regions")} testId="stats-regions">
          <ul className="flex flex-col gap-2">
            {stats.regions.map((r) => (
              <li key={r.region} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-[12.5px] text-ink">{r.region}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                  <span className="block h-full rounded-full bg-accent/70" style={{ width: `${(r.nb / maxRegion) * 100}%` }} />
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-muted">
                  {r.nb}{r.note_moyenne != null ? ` · ${format.number(r.note_moyenne)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Bloc>
      )}

      {stats.cepages.length > 0 && (
        <Bloc titre={t("stats.cepages")} testId="stats-cepages">
          <ul className="flex flex-wrap gap-1.5">
            {stats.cepages.map((c) => (
              <li key={c.cepage} className="rounded-full border border-line bg-surface-hover px-3 py-1.5 text-[11.5px] text-ink">
                {c.cepage}{c.note_moyenne != null ? ` · ${format.number(c.note_moyenne)}` : ""}
              </li>
            ))}
          </ul>
        </Bloc>
      )}

      <Bloc titre={t("stats.depense")} testId="stats-depense">
        <p className="text-[13px] text-ink">
          {t("stats.totalPaye", { montant: euros(stats.depense.totalPaye) })}
        </p>
        {stats.depense.bouteilles ? (
          <p data-testid="stats-comparaison" className="mt-1 text-[12px] text-muted">
            {t("stats.comparaison", {
              paye: euros(stats.depense.bouteilles.paye),
              estime: euros(stats.depense.bouteilles.estime),
              n: stats.depense.bouteilles.nb,
            })}
          </p>
        ) : (
          // Sans une seule bouteille dont l'étiquette a été analysée, il n'y a
          // rien à comparer — mieux vaut le dire que d'afficher « 0 € estimé ».
          <p className="mt-1 text-[12px] text-faint">{t("stats.comparaisonIndispo")}</p>
        )}

        <div className="mt-4 flex items-end gap-2" aria-hidden>
          {stats.depense.mois.map((m) => (
            <div key={m.mois} className="flex flex-1 flex-col items-center gap-1">
              <span className="flex h-24 w-full items-end">
                <span className="w-full rounded-t-[3px] bg-accent/25" style={{ height: `${Math.max((m.montant / maxMois) * 100, 2)}%` }} />
              </span>
              <span className="text-[10px] text-faint">{moisCourt(m.mois, format)}</span>
            </div>
          ))}
        </div>
        <ul className="sr-only">
          {stats.depense.mois.map((m) => (
            <li key={m.mois}>{moisCourt(m.mois, format)} : {euros(m.montant)}</li>
          ))}
        </ul>
      </Bloc>
    </div>
  );
}

/** « avr », « mai » — le mois seul suffit sous une barre, l'année est dans le titre du bloc. */
function moisCourt(mois: string, format: Awaited<ReturnType<typeof getFormatter>>): string {
  const [annee, m] = mois.split("-");
  return format.dateTime(new Date(Date.UTC(Number(annee), Number(m) - 1, 1)), { month: "short", timeZone: "UTC" });
}

function Tuile({ valeur, label, borde = false }: { valeur: string; label: string; borde?: boolean }) {
  return (
    <div className={`px-4 py-4 ${borde ? "border-l border-line" : ""}`}>
      <div className="font-serif text-3xl font-medium text-ink">{valeur}</div>
      <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">{label}</div>
    </div>
  );
}

function Bloc({ titre, testId, children }: { titre: string; testId: string; children: React.ReactNode }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{titre}</h2>
      {children}
    </section>
  );
}
