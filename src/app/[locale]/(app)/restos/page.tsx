import { getTranslations } from "next-intl/server";
import { RestoSearch } from "@/features/restos/ui/RestoSearch";
import { GoutsBanner } from "@/features/reco/ui/GoutsBanner";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { PlacesTabs } from "@/features/places/ui/PlacesTabs";
import { getPlaces } from "@/features/places/data/queries";

export default async function RestosPage() {
  const t = await getTranslations("restos");
  return (
    <main className="p-4 md:p-6 flex flex-col gap-6">
      <PageHeader title={t("title")} />
      <GoutsBanner />
      <RestoSearch />
      <PlacesTabs category="resto" places={await getPlaces("resto")} />
    </main>
  );
}
