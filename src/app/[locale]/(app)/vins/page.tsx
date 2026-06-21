import { getTranslations } from "next-intl/server";
import { VinsFilters } from "@/features/vins/ui/VinsFilters";
import { VinsList } from "@/features/vins/ui/VinsList";

export default async function VinsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("vins");
  const sp = await searchParams;
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <VinsFilters />
      <VinsList searchParams={sp} />
    </main>
  );
}
