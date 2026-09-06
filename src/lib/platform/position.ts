import { estNatif } from "./natif";

export type Position = { lat: number; lng: number };

// « Autour de moi ».
//
// Le web demande la position au navigateur ; la coque la demande à iOS, qui
// affiche sa propre autorisation (le texte vient de `NSLocationWhenInUse-
// UsageDescription`) et rend une position plus précise, sans la bannière
// permanente de Safari.
//
// Un refus n'est pas une erreur : c'est une réponse. On rend `null`, et
// l'appelant continue sans position plutôt que d'afficher une alerte de plus.
export async function positionActuelle(): Promise<Position | null> {
  if (estNatif()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      return { lat: p.coords.latitude, lng: p.coords.longitude };
    } catch {
      return null;
    }
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
    );
  });
}
