import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { CategoryTabs } from "@/features/places/ui/CategoryTabs";
import { getPlaces, getArchivedPlaces } from "@/features/places/data/queries";
import { getTagsForCategory } from "@/features/restos/data/queries";

// Onglet Hôtels v2 (design Onglet_Hotels_v2) : sous-onglets par statut
// (Favoris / À tester / Séjours / Tous / Carte), rendus par la brique
// générique CategoryTabs partagée avec Restaurants.
export default async function HotelsPage() {
  const t = await getTranslations("hotels");
  const [places, archived, tags] = await Promise.all([
    getPlaces("hotel"),
    getArchivedPlaces("hotel"),
    getTagsForCategory("hotel"),
  ]);
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1200px]">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <CategoryTabs places={places} archived={archived} tags={tags} categorie="hotel" />
    </main>
  );
}
