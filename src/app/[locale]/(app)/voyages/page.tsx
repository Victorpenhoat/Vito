import { getTranslations } from "next-intl/server";
import { VoyageForm } from "@/features/voyages/ui/VoyageForm";
import { VoyagesList } from "@/features/voyages/ui/VoyagesList";
import { getMesVoyages } from "@/features/voyages/data/queries";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function VoyagesPage() {
  const t = await getTranslations("voyages");
  const voyages = await getMesVoyages();
  const today = new Date().toISOString().slice(0, 10);
  const avenir = voyages.filter((v) => (v.statut === "planifie" || v.statut === "confirme") && v.date_debut != null && v.date_debut >= today).length;
  const passes = voyages.length - avenir;
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("heading")} subtitle={t("compte", { avenir, passes })} />
      <VoyageForm />
      <VoyagesList />
    </main>
  );
}
