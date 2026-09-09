import { getTranslations } from "next-intl/server";
import { getActivites } from "../data/queries";
import { filtrerActivites } from "../domain/liste";
import { CarteActivitesLazy } from "./CarteActivitesLazy";
import { FiltresActivites } from "./FiltresActivites";

/**
 * La carte des lieux. Filtrable par membre, comme la liste — et par le même
 * composant, donc les mêmes paramètres d'URL : passer de la liste à la carte
 * garde les filtres posés.
 */
export async function VueCarte({ params, aujourdhui }: {
  params: Record<string, string | string[] | undefined>;
  aujourdhui: string;
}) {
  const t = await getTranslations("activites");
  const toutes = await getActivites(aujourdhui);
  const membres = typeof params.membre === "string" ? [params.membre]
    : Array.isArray(params.membre) ? params.membre : [];

  const filtrees = filtrerActivites(toutes, { membres });
  const points = filtrees.flatMap((a) =>
    a.lat != null && a.lng != null
      ? [{
          id: a.id, nom: a.nom, clubNom: a.clubNom, adresse: a.adresse,
          lat: a.lat, lng: a.lng, statut: a.statut, membres: a.membres,
        }]
      : []);

  const membresConnus = [...new Map(toutes.flatMap((a) => a.membres).map((m) => [m.id, m])).values()];

  return (
    <div className="flex flex-col gap-3">
      {membresConnus.length > 0 && (
        <FiltresActivites params={params} dimensions={[{
          cle: "membre", libelle: t("filtres.membre"),
          options: membresConnus.map((m) => ({ valeur: m.id, libelle: m.prenom, couleur: m.couleur })),
        }]} />
      )}
      <CarteActivitesLazy points={points} sansAdresse={filtrees.length - points.length} />
    </div>
  );
}
