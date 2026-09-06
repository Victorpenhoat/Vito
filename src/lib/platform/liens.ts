import { estNatif } from "./natif";

// Ouverture d'un lien qui sort de Vito (Google Maps, le site d'un restaurant,
// la page d'un marchand).
//
// Dans la coque, un `target="_blank"` ne mène nulle part : la WebView n'a pas
// d'onglets. Pire, un lien ordinaire remplacerait Vito par le site visité, sans
// barre d'adresse ni bouton retour — l'utilisateur serait piégé, et c'est
// exactement ce qu'Apple reproche aux sites emballés.
//
// On passe donc par le navigateur du système (SFSafariViewController) : il se
// pose PAR-DESSUS l'app, garde sa barre et son « Terminé », et laisse Vito
// intact derrière.
export async function ouvrirLienExterne(url: string): Promise<void> {
  if (!url) return;
  if (estNatif()) {
    // Import paresseux : le bundle web ne porte pas le plugin, il n'est
    // téléchargé que dans la coque.
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return;
  }
  // Web : nouvel onglet, sans donner à la page ouverte la main sur la nôtre.
  window.open(url, "_blank", "noopener,noreferrer");
}
