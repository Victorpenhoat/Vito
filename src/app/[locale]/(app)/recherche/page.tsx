import { getTranslations } from "next-intl/server";
import { RechercheForm } from "@/features/reco/ui/RechercheForm";
import { RechercheResults } from "@/features/reco/ui/RechercheResults";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function RecherchePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("recherche");
  const sp = await searchParams;
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <RechercheForm />
      <RechercheResults searchParams={sp} />
    </main>
  );
}
