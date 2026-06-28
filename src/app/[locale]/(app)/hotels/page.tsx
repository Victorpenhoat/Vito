import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { PlacesTabs } from "@/features/places/ui/PlacesTabs";
import { getPlaces, getArchivedPlaces } from "@/features/places/data/queries";

export default async function HotelsPage() {
  const t = await getTranslations("hotels");
  const places = await getPlaces("hotel");
  const archived = await getArchivedPlaces("hotel");
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader title={t("title")} />
      <PlacesTabs category="hotel" places={places} archived={archived} />
    </main>
  );
}
