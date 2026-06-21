import { getTranslations } from "next-intl/server";
import { VoyageForm } from "@/features/voyages/ui/VoyageForm";
import { VoyagesList } from "@/features/voyages/ui/VoyagesList";

export default async function VoyagesPage() {
  const t = await getTranslations("voyages");
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <VoyageForm />
      <VoyagesList />
    </main>
  );
}
