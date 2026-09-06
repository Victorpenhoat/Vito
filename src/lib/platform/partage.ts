import { estNatif } from "./natif";

export type Partage = { titre?: string; texte?: string; url: string };
/** Ce qui s'est réellement passé — l'appelant n'affiche « Copié » que si ça l'est. */
export type ResultatPartage = "natif" | "web" | "copie" | "annule";

// Partager une fiche, un voyage, un lien.
//
// Trois chemins pour un seul geste : la feuille de partage iOS dans la coque,
// l'API du navigateur quand il en a une, et le presse-papiers en dernier
// recours. L'appelant n'a pas à savoir lequel a servi — sauf pour dire « Lien
// copié » quand c'est bien ce qui s'est passé.
export async function partager({ titre, texte, url }: Partage): Promise<ResultatPartage> {
  if (estNatif()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: titre, text: texte, url });
      return "natif";
    } catch {
      // L'utilisateur a fermé la feuille de partage : ce n'est pas un échec, et
      // il ne faut surtout pas lui copier le lien dans le dos.
      return "annule";
    }
  }
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: titre, text: texte, url });
      return "web";
    } catch {
      return "annule";
    }
  }
  await navigator.clipboard.writeText(url);
  return "copie";
}
