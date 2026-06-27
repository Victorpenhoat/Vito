import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProche } from "@/features/famille/data/queries";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { ProcheForm } from "@/features/famille/ui/ProcheForm";

export default async function ModifierProchePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("famille");
  const data = await getProche(id);
  if (!data) notFound();
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("fiche.modifier")} />
      <ProcheForm mode="edit" initial={data.proche} />
    </main>
  );
}
