import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { Link } from "@/lib/i18n/routing";
import { getMesVoyages, compterParticipants } from "@/features/voyages/data/queries";
import { VACANCES_ZONE_C, ZONE_SCOLAIRE } from "@/features/voyages/data/vacancesScolaires";
import { PlanningCalendrier } from "@/features/voyages/ui/PlanningCalendrier";
import { PlanningFrise } from "@/features/voyages/ui/PlanningFrise";

// Planning (maquettes « Planning Mois » et « Web — Planning global ») : un
// calendrier, les voyages sous la semaine qu'ils traversent, et l'année
// scolaire qui montre ce qui reste libre.
export default async function PlanningPage() {
  const t = await getTranslations("voyages");
  const [voyages, participants] = await Promise.all([getMesVoyages(), compterParticipants()]);

  return (
    <main className="flex flex-col gap-5 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1000px]">
      <div className="flex flex-col gap-2">
        <PageHeader eyebrow={t("eyebrow")} title={t("planning.titre")} />
        <Link href="/voyages" data-testid="planning-retour" className="text-[12.5px] font-semibold text-accent hover:underline">
          ← {t("planning.retour")}
        </Link>
      </div>
      <PlanningCalendrier
        voyages={voyages.map((v) => ({
          id: v.id, titre: v.titre, debut: v.date_debut, fin: v.date_fin,
          statut: v.statut, participants: participants[v.id] ?? 0,
        }))}
        vacances={VACANCES_ZONE_C}
        aujourdhui={new Date().toISOString().slice(0, 10)}
        zone={ZONE_SCOLAIRE}
        vueAnnee={
          <PlanningFrise
            voyages={voyages.map((v) => ({ id: v.id, titre: v.titre, debut: v.date_debut, fin: v.date_fin }))}
            vacances={VACANCES_ZONE_C}
            aujourdhui={new Date().toISOString().slice(0, 10)} />
        }
      />
    </main>
  );
}
