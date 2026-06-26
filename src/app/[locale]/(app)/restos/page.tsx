import { getTranslations } from "next-intl/server";
import { PlaceSearch } from "@/features/places/ui/PlaceSearch";
import { GoutsBanner } from "@/features/reco/ui/GoutsBanner";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { PlacesTabs } from "@/features/places/ui/PlacesTabs";
import { getPlaces } from "@/features/places/data/queries";

export default async function RestosPage() {
  const t = await getTranslations("restos");
  const places = await getPlaces("resto");
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader title={t("title")} />
      <GoutsBanner />
      <PlaceSearch places={places} category="resto" />
      <PlacesTabs category="resto" places={places} />
    </main>
  );
}
