import { FicheResto } from "@/features/restos/ui/FicheResto";
import { CategoryTabs } from "@/features/places/ui/CategoryTabs";
import { getPlaces, getArchivedPlaces } from "@/features/places/data/queries";
import { getTagsForCategory } from "@/features/restos/data/queries";

// Fiche d'un restaurant. Sur grand écran, elle s'ouvre À CÔTÉ de la liste
// plutôt que de la remplacer : l'écran est assez large pour les deux, et on
// passe d'une adresse à l'autre sans faire l'aller-retour. Sur téléphone,
// c'est la fiche seule, comme avant.
export default async function FicheRestoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [places, archived, tags] = await Promise.all([
    getPlaces("resto"),
    getArchivedPlaces("resto"),
    getTagsForCategory("restaurant"),
  ]);
  return (
    <main className="p-4 md:p-6 lg:mx-auto lg:w-full lg:max-w-[1400px] lg:p-8">
      <CategoryTabs places={places} archived={archived} tags={tags} categorie="resto"
        selectedId={id} detail={<FicheResto etablissementId={id} />} />
    </main>
  );
}
