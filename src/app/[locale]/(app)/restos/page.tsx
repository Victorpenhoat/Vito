import { getTranslations } from "next-intl/server";
import { GoutsBanner } from "@/features/reco/ui/GoutsBanner";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { CategoryTabs } from "@/features/places/ui/CategoryTabs";
import { getPlaces, getArchivedPlaces } from "@/features/places/data/queries";
import { getTagsForCategory } from "@/features/restos/data/queries";

// Onglet Restaurants v2 (design Onglet_Resto_v2) : sous-onglets par statut,
// rendus par la brique générique CategoryTabs (partagée avec Hôtels).
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
      <CategoryTabs places={places} archived={archived} tags={tags} categorie="resto" />
    </main>
  );
}
