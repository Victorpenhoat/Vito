import { getTranslations } from "next-intl/server";
import { GroupeForm } from "@/features/depenses/ui/GroupeForm";
import { GroupesList } from "@/features/depenses/ui/GroupesList";
import { getMesVoyages } from "@/features/voyages/data/queries";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function DepensesPage() {
  const t = await getTranslations("depenses");
  const voyages = (await getMesVoyages()).map((v) => ({ id: v.id, titre: v.titre }));
  return (
    <main className="p-4 md:p-6 flex flex-col gap-6">
      <PageHeader title={t("title")} />
      <GroupeForm voyages={voyages} />
      <GroupesList />
    </main>
  );
}
