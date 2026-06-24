import { getTranslations } from "next-intl/server";
import { RestoSearch } from "@/features/restos/ui/RestoSearch";
import { RestoList } from "@/features/restos/ui/RestoList";
import { GoutsBanner } from "@/features/reco/ui/GoutsBanner";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function RestosPage() {
  const t = await getTranslations("restos");
  return (
    <main className="p-4 md:p-6 flex flex-col gap-6">
      <PageHeader title={t("title")} />
      <GoutsBanner />
      <RestoSearch />
      <RestoList />
    </main>
  );
}
