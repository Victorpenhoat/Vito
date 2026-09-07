import { estNatif } from "./natif";

/**
 * Le chemin à ouvrir dans l'app pour une URL reçue d'iOS, ou `null` si elle ne
 * nous concerne pas.
 *
 * iOS remet l'URL COMPLÈTE (« https://vito.exemple/api/auth/confirm?… »). La
 * WebView, elle, est déjà sur ce domaine : lui donner l'URL entière la ferait
 * recharger inutilement, et lui donner une URL d'un AUTRE domaine serait une
 * redirection ouverte offerte à qui sait forger un lien. On ne garde donc que
 * le chemin, et seulement s'il vient bien de chez nous.
 */
export function cheminDuLien(url: string, origineAttendue: string): string | null {
  let recu: URL;
  let attendue: URL;
  try {
    recu = new URL(url);
    attendue = new URL(origineAttendue);
  } catch {
    return null;
  }
  if (recu.origin !== attendue.origin) return null;
  return `${recu.pathname}${recu.search}${recu.hash}`;
}

/**
 * Écoute les liens qu'iOS remet à l'app (Universal Links) et les ouvre dans la
 * WebView. Rend la fonction de désabonnement.
 *
 * Sur le web, il n'y a rien à écouter : la fonction ne fait rien et le dit en
 * rendant un désabonnement vide.
 */
export async function ecouterLiensProfonds(
  origine: string,
  ouvrir: (chemin: string) => void,
): Promise<() => void> {
  if (!estNatif()) return () => {};
  const { App } = await import("@capacitor/app");
  const abonnement = await App.addListener("appUrlOpen", ({ url }) => {
    const chemin = cheminDuLien(url, origine);
    if (chemin) ouvrir(chemin);
  });
  return () => void abonnement.remove();
}
