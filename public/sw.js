// Service worker de Vito.
//
// Règle de fond : on ne met JAMAIS en cache automatiquement une page ou une
// réponse d'API. Tout ce qui est stocké l'a été explicitement par l'utilisateur,
// en activant le mode voyage sur un voyage précis (cf. horsLigneClient.ts).
// Sans cela, le carnet d'un compte resterait lisible sur un appareil partagé.

const COQUILLE = "vito-coquille-v2";
const HORS_LIGNE = "vito-hors-ligne"; // rempli par la page — cf. CACHE_HORS_LIGNE
const REPLI = "/fr";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(COQUILLE).then((c) => c.addAll([REPLI])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) =>
        Promise.all(
          // ⚠ HORS_LIGNE survit aux mises à jour : c'est le carnet que
          // l'utilisateur a délibérément emporté, pas un cache technique.
          cles.filter((k) => k !== COQUILLE && k !== HORS_LIGNE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Sans réseau : servir l'exact équivalent s'il a été emporté, sinon le carnet
 * téléchargé (c'est le sens du mode voyage : la seule chose utile hors ligne),
 * sinon la coquille d'accueil.
 */
async function repliHorsLigne(request) {
  const cache = await caches.open(HORS_LIGNE);
  const exact = await cache.match(request, { ignoreSearch: true });
  if (exact) return exact;

  if (request.mode === "navigate") {
    const cles = await cache.keys();
    const carnet = cles.find((r) => new URL(r.url).pathname.includes("/carnet-hors-ligne/"));
    if (carnet) return cache.match(carnet);
  }
  const coquille = await caches.match(REPLI);
  return coquille ?? Response.error();
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Réseau d'abord : en ligne, l'application se comporte exactement comme sans
  // service worker — jamais de page périmée servie à la place de la vraie.
  e.respondWith(fetch(e.request).catch(() => repliHorsLigne(e.request)));
});
