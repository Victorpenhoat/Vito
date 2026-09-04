import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { Link } from "@/lib/i18n/routing";
import { getMesVoyages } from "@/features/voyages/data/queries";
import { VACANCES_ZONE_C } from "@/features/voyages/data/vacancesScolaires";
import { PlanningFrise } from "@/features/voyages/ui/PlanningFrise";

// Planning (Lot E) : douze mois où se superposent les voyages et les vacances
// scolaires — pour voir ce qui tombe pendant les vacances, et ce qui reste libre.
export default async function PlanningPage() {
  const t = await getTranslations("voyages");
  const voyages = await getMesVoyages();

  return (
    <main className="flex flex-col gap-5 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1200px]">
      <div className="flex flex-col gap-2">
        <PageHeader eyebrow={t("eyebrow")} title={t("planning.titre")} />
        <Link href="/voyages" data-testid="planning-retour" className="text-[12.5px] font-semibold text-accent hover:underline">
          ← {t("planning.retour")}
        </Link>
      </div>
      <PlanningFrise
        voyages={voyages.map((v) => ({ id: v.id, titre: v.titre, debut: v.date_debut, fin: v.date_fin }))}
        vacances={VACANCES_ZONE_C}
        aujourdhui={new Date().toISOString().slice(0, 10)}
      />
    </main>
  );
}
