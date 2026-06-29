import { getTranslations } from "next-intl/server";
import { GoutsBanner } from "@/features/reco/ui/GoutsBanner";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { PlacesTabs } from "@/features/places/ui/PlacesTabs";
import { getPlaces, getArchivedPlaces } from "@/features/places/data/queries";

export default async function RestosPage() {
  const t = await getTranslations("restos");
  const places = await getPlaces("resto");
  const archived = await getArchivedPlaces("resto");
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1200px]">
      <PageHeader title={t("title")} />
      <GoutsBanner />
      <PlacesTabs category="resto" places={places} archived={archived} />
    </main>
  );
}
