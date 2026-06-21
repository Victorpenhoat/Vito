import { getTranslations } from "next-intl/server";
import { RechercheForm } from "@/features/reco/ui/RechercheForm";
import { RechercheResults } from "@/features/reco/ui/RechercheResults";

export default async function RecherchePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("recherche");
  const sp = await searchParams;
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <RechercheForm />
      <RechercheResults searchParams={sp} />
    </main>
  );
}
