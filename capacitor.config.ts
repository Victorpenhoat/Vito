import type { CapacitorConfig } from "@capacitor/cli";

// Coque iOS de Vito (Capacitor).
//
// STRATÉGIE : la WebView charge l'origine HTTPS de production, elle n'embarque
// pas un export statique. Ce n'est pas de la paresse — c'est ce que le code
// impose : 31 des 39 pages sont des composants serveur, 102 actions serveur,
// et surtout les documents (Cercle, vouchers, tickets) sont déchiffrés par une
// route serveur avec une clé qui ne doit jamais atteindre le client. Un export
// statique reviendrait à ne plus les chiffrer.
//
// L'origine HTTPS a un second mérite : les passkeys. WebAuthn est lié à
// l'origine chargée ; sous `capacitor://localhost`, `signInWithPasskey()` ne
// fonctionne pas. En chargeant le domaine de production, la connexion par
// passkey reste celle du web.
//
// Ce que l'app apporte de natif — géolocalisation, partage, ouverture des liens
// hors WebView, carnet hors ligne — arrive par les plugins, lot par lot.
const config: CapacitorConfig = {
  // Arrêtés par le PO le 2026-09-06. Le bundle ID devient DÉFINITIF à la
  // création de l'app dans App Store Connect : après, il ne se change plus.
  // Les variables restent, pour une build de test sous un autre identifiant.
  appId: process.env.CAP_APP_ID ?? "com.badakan.vito",
  appName: process.env.CAP_APP_NAME ?? "Vito",

  // Dossier web embarqué. Avec `server.url`, la WebView ne l'affiche pas : il
  // ne sert qu'à satisfaire `cap sync` et à porter l'écran de repli.
  webDir: "capacitor/www",

  server: {
    url: process.env.CAP_SERVER_URL ?? "https://vito-theta.vercel.app",
    // Le mode voyage hors ligne passe par un service worker, qui exige une
    // origine sûre. HTTPS uniquement, donc — jamais de cleartext.
    androidScheme: "https",
    iosScheme: "https",
  },

  ios: {
    // La coque s'annonce. C'est ce qui permet au SERVEUR de savoir qu'il rend
    // pour l'app — et donc de ne pas y afficher l'abonnement (règle 3.1.1
    // d'Apple), sans que la page clignote le temps qu'un script s'en aperçoive.
    appendUserAgent: "VitoiOS",
    // Le fond de l'app (--app du thème clair) : la bande sous la WebView
    // pendant le rebond du défilement, et derrière les safe areas.
    backgroundColor: "#FBF9F3",
    // La WebView ne rebondit pas : dans une app, un défilement élastique sur
    // toute la page trahit la page web.
    scrollEnabled: true,
    contentInset: "always",
  },
};

export default config;
