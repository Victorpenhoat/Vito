"use client";
import { CACHE_HORS_LIGNE, CLE_META, cheminCarnet, cheminDocument, type MetaCarnet } from "../domain/horsLigne";

// Stockage du carnet SUR L'APPAREIL, via l'API Cache — le même magasin que
// celui du service worker, qui pourra donc le servir sans réseau.
//
// Un seul carnet à la fois : c'est « le voyage en cours », pas une archive. En
// retélécharger un efface le précédent, ce qui borne aussi ce qui traîne en
// clair sur le téléphone.

/** L'API Cache manque en contexte non sécurisé (et dans certains navigateurs privés). */
function disponible(): boolean {
  return typeof caches !== "undefined";
}

/** Ce qui est actuellement téléchargé, ou null. */
export async function etatCarnet(): Promise<MetaCarnet | null> {
  if (!disponible()) return null;
  try {
    const cache = await caches.open(CACHE_HORS_LIGNE);
    const reponse = await cache.match(CLE_META);
    return reponse ? ((await reponse.json()) as MetaCarnet) : null;
  } catch {
    return null;
  }
}

/**
 * Télécharge la page du carnet et ses pièces jointes. On mesure au passage ce
 * qui a été stocké, pour pouvoir l'annoncer honnêtement à l'écran.
 */
export async function enregistrerCarnet(
  locale: string,
  voyageId: string,
  documentIds: string[],
): Promise<MetaCarnet> {
  if (!disponible()) throw new Error("cache-indisponible");
  // Repartir d'un cache vide : sinon les pièces d'un voyage précédent
  // resteraient sur l'appareil sans être listées nulle part.
  await caches.delete(CACHE_HORS_LIGNE);
  const cache = await caches.open(CACHE_HORS_LIGNE);

  let octets = 0;
  const urls = [cheminCarnet(locale, voyageId), ...documentIds.map(cheminDocument)];
  for (const url of urls) {
    const reponse = await fetch(url, { credentials: "same-origin" });
    if (!reponse.ok) throw new Error(`indisponible: ${url}`);
    // Une réponse ne se lit qu'une fois : on mesure sur une copie.
    const copie = reponse.clone();
    await cache.put(url, reponse);
    octets += (await copie.blob()).size;
  }

  const meta: MetaCarnet = { voyageId, locale, enregistreLe: Date.now(), octets, documents: documentIds.length };
  await cache.put(CLE_META, new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } }));
  return meta;
}

/** Retire le carnet de l'appareil (bouton dédié, et déconnexion). */
export async function retirerCarnet(): Promise<void> {
  if (!disponible()) return;
  try { await caches.delete(CACHE_HORS_LIGNE); } catch { /* rien à retirer */ }
}
