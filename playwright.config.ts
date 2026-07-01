import { defineConfig } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3001";

export default defineConfig({
  testDir: "./e2e",
  // Tous les tests partagent les comptes seed (ex. client@vito.test) sans isolation de session :
  // en parallèle, plusieurs workers s'authentifiant comme le même user provoquent des "Non authentifié".
  // Dette suivie : passer à une isolation par storageState (auth une fois, cookie réutilisé) pour restaurer le parallélisme.
  workers: 1,
  // Flakes de timing connus sous charge CI (race RSC fiche proche, formulaires lents à s'activer,
  // permission denied liste_items anon en préfetch) : ils passent au re-run. On laisse Playwright
  // re-tenter en CI plutôt que de re-runner le job entier à la main. 0 en local (échec = vrai échec).
  retries: process.env.CI ? 2 : 0,
  // Trace + screenshot sur échec/retry : indispensables pour diagnostiquer les flakes
  // sous charge CI (le run local ne les reproduit pas). Uploadés en artefact par la CI.
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && PORT=${PORT} npm run start`,
    url: `http://localhost:${PORT}/fr`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { PORT: String(PORT) },
  },
});
