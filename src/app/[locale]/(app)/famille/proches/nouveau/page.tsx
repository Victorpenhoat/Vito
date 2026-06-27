import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { ProcheForm } from "@/features/famille/ui/ProcheForm";

export default async function NouveauProchePage() {
  const t = await getTranslations("famille");
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("proches.ajouter")} />
      <ProcheForm mode="create" />
    </main>
  );
}
