import { FicheResto } from "@/features/restos/ui/FicheResto";
import { CategoryTabs } from "@/features/places/ui/CategoryTabs";
import { getPlaces, getArchivedPlaces } from "@/features/places/data/queries";
import { getTagsForCategory } from "@/features/restos/data/queries";

// Fiche d'un hébergement — même mécanique que côté restaurants (brique
// générique) : liste + fiche sur grand écran, fiche seule sur téléphone.
export default async function HotelFichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [places, archived, tags] = await Promise.all([
    getPlaces("hotel"),
    getArchivedPlaces("hotel"),
    getTagsForCategory("hotel"),
  ]);
  return (
    <main className="p-4 md:p-6 lg:mx-auto lg:w-full lg:max-w-[1400px] lg:p-8">
      <CategoryTabs places={places} archived={archived} tags={tags} categorie="hotel"
        selectedId={id} detail={<FicheResto etablissementId={id} category="hotel" />} />
    </main>
  );
}
