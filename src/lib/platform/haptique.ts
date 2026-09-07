import { estNatif } from "./natif";

// Retour haptique.
//
// Volontairement rare : une vibration à chaque interaction devient du bruit, et
// le geste perd le sens qu'on voulait lui donner. On le réserve aux actions qui
// changent l'état du carnet sans le dire autrement — le favori, qui n'ouvre
// aucun écran et n'affiche aucun message.
//
// Sans effet sur le web : `navigator.vibrate` n'existe pas sur iOS Safari, et
// faire vibrer un ordinateur de bureau n'a pas de sens.
export async function toucher(): Promise<void> {
  if (!estNatif()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Un appareil sans moteur haptique, ou l'utilisateur qui l'a coupé : le
    // geste principal a déjà eu lieu, il n'y a rien à rattraper.
  }
}
