import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getActivitesDuMembre, getAlertesActivites } from "../data/queries";
import { construireAlertes } from "../domain/alertes";

/**
 * Bloc « Activités » de la fiche d'un proche (design écran 11).
 *
 * C'est une SECTION de la fiche existante, pas un écran de plus : on est venu
 * voir la personne, on voit au passage ce qu'elle pratique et ce qui traîne.
 */
export async function BlocActivitesMembre({ membreId }: { membreId: string }) {
  const t = await getTranslations("activites");
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const activites = (await getActivitesDuMembre(membreId, aujourdhui))
    .filter((a) => a.statut === "en_cours");
  if (activites.length === 0) return null;

  const ids = new Set(activites.map((a) => a.id));
  const source = await getAlertesActivites();
  const aTraiter = construireAlertes(source, aujourdhui)
    .filter((al) => ids.has(al.activiteId) && al.urgence !== "plus_tard");

  return (
    <section data-testid="membre-activites" className="flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
          {t("membre.enCours", { n: activites.length })}
        </h2>
        <Link href="/activites" className="text-[12.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
          {t("membre.toutVoir")} →
        </Link>
      </div>
      <ul className="divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface">
        {activites.map((a) => (
          <li key={a.id} data-testid="membre-activite-row">
            <Link href={`/activites/${a.id}`} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{a.nom}</span>
                <span className="block truncate text-[11.5px] text-muted">{a.clubNom}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {aTraiter.length > 0 && (
        // Ce qui traîne se dit ici aussi : on ne vient pas sur cette fiche pour
        // découvrir un certificat expiré ailleurs.
        <Link href="/activites/alertes" data-testid="membre-activites-alertes"
          className="mt-2 flex items-center justify-between gap-2 rounded-card border border-current/20 bg-kpi-amber-bg px-3 py-2 text-[12px] font-semibold text-kpi-amber">
          {t("membre.aTraiter", { n: aTraiter.length })}
          <span className="shrink-0">{t("alertes.traiter")} →</span>
        </Link>
      )}
    </section>
  );
}
