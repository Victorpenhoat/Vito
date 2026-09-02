import { getTranslations } from "next-intl/server";
import { GoutsBanner } from "@/features/reco/ui/GoutsBanner";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { RestosTabs } from "@/features/restos/ui/RestosTabs";
import { getPlaces, getArchivedPlaces } from "@/features/places/data/queries";
import { getTagsForCategory } from "@/features/restos/data/queries";

// Onglet Restaurants v2 (design Onglet_Resto_v2) : sous-onglets par statut.
// L'onglet Hôtels reste sur PlacesTabs (structure historique).
export default async function RestosPage() {
  const t = await getTranslations("restos");
  const [places, archived, tags] = await Promise.all([
    getPlaces("resto"),
    getArchivedPlaces("resto"),
    getTagsForCategory("restaurant"),
  ]);
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1200px]">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <GoutsBanner />
      <RestosTabs places={places} archived={archived} tags={tags} />
    </main>
  );
}
