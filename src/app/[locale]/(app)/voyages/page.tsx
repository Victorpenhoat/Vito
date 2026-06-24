import { getTranslations } from "next-intl/server";
import { VoyageForm } from "@/features/voyages/ui/VoyageForm";
import { VoyagesList } from "@/features/voyages/ui/VoyagesList";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function VoyagesPage() {
  const t = await getTranslations("voyages");
  return (
    <main className="p-6 flex flex-col gap-6">
      <PageHeader title={t("title")} />
      <VoyageForm />
      <VoyagesList />
    </main>
  );
}
