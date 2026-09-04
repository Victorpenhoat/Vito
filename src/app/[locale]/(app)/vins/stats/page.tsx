import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { Link } from "@/lib/i18n/routing";
import { getCaveStats } from "@/features/vins/data/queries";
import { calculerCaveStats } from "@/features/vins/domain/caveStats";
import { CaveStatsPanel } from "@/features/vins/ui/CaveStatsPanel";

// « Ma cave en chiffres » (design Vins & Cave écran 7) : un écran à part plutôt
// qu'un sous-onglet de plus — le lien se partage, et la Cave reste une liste.
export default async function CaveStatsPage() {
  const t = await getTranslations("vins");
  const source = await getCaveStats();
  // La date entre par l'argument : les six mois suivis se calculent au rendu,
  // le domaine reste pur (et testable sans geler l'horloge).
  const stats = calculerCaveStats(source, new Date());

  return (
    <main className="flex flex-col gap-6 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1200px]">
      <div className="flex flex-col gap-2">
        <PageHeader eyebrow={t("cave.titre")} title={t("stats.titre")} />
        <Link href="/restos?onglet=cave" data-testid="stats-retour" className="text-[12.5px] font-semibold text-accent hover:underline">
          ← {t("stats.retour")}
        </Link>
      </div>
      <CaveStatsPanel stats={stats} />
    </main>
  );
}
