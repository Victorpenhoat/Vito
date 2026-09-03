import { getTranslations } from "next-intl/server";
import { VinsFilters } from "@/features/vins/ui/VinsFilters";
import { VinsCouleurTabs } from "@/features/vins/ui/VinsCouleurTabs";
import { VinsList } from "@/features/vins/ui/VinsList";
import { AjouterVinButton } from "@/features/vins/ui/AjouterVinButton";
import { getVinsCount, getVinsConnus } from "@/features/vins/data/queries";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function VinsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("vins");
  const sp = await searchParams;
  const [count, vinsConnus] = await Promise.all([getVinsCount(), getVinsConnus()]);
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("compte", { n: count })} />
      <AjouterVinButton vinsConnus={vinsConnus} />
      <VinsCouleurTabs />
      <VinsFilters />
      <VinsList searchParams={sp} />
    </main>
  );
}
