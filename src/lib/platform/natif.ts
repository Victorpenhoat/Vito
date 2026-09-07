// Détection de la coque native.
//
// On ne lit PAS `@capacitor/core` : Capacitor injecte son pont dans la WebView
// sous forme de global, et l'interroger évite d'embarquer quoi que ce soit dans
// le bundle web. Le web ne paie rien pour l'existence de l'app iOS.
//
// Si le pont manque — page web ordinaire, injection ratée, rendu serveur —, la
// réponse est « non », et tout le reste retombe sur le comportement web. Un
// échec de détection dégrade, il ne casse pas.

type PontCapacitor = { isNativePlatform?: () => boolean; getPlatform?: () => string };

function pont(): PontCapacitor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Capacitor?: PontCapacitor }).Capacitor ?? null;
}

/** Vrai dans la coque iOS, faux dans un navigateur et au rendu serveur. */
export function estNatif(): boolean {
  try {
    return pont()?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/** « ios », « android », ou « web » — pour les rares cas où la nuance compte. */
export function plateforme(): string {
  try {
    return pont()?.getPlatform?.() ?? "web";
  } catch {
    return "web";
  }
}
