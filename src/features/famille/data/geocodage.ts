import "server-only";
import { getPlacesProvider } from "@/lib/services/places";

/**
 * Convertit l'adresse du foyer en coordonnées.
 *
 * On RÉUTILISE le fournisseur d'adresses déjà câblé pour le carnet — pas un
 * second service de géocodage : la clé est la même, côté serveur, et le résultat
 * est stocké une fois pour toutes.
 *
 * `null` quand rien n'est trouvé, ou qu'aucun fournisseur n'est configuré. La
 * durée de trajet ne s'affiche alors pas — mieux vaut ne rien dire qu'un
 * « ~5 min » calculé depuis un point faux.
 */
export async function geocoderAdresse(adresse: string | null): Promise<{ lat: number; lng: number } | null> {
  const requete = adresse?.trim();
  if (!requete) return null;
  try {
    // `opts` non vide : c'est ce qui demande la position au fournisseur.
    const resultats = await getPlacesProvider().search(requete, { includedType: undefined });
    const premier = resultats.find((r) => r.lat != null && r.lng != null);
    return premier ? { lat: premier.lat!, lng: premier.lng! } : null;
  } catch {
    // Un géocodage raté ne doit jamais empêcher d'enregistrer une adresse :
    // c'est un confort, pas la donnée.
    return null;
  }
}
