import { defineConfig } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3001";

export default defineConfig({
  testDir: "./e2e",
  // Tous les tests partagent les comptes seed (ex. client@vito.test) sans isolation de session :
  // en parallèle, plusieurs workers s'authentifiant comme le même user provoquent des "Non authentifié".
  // Dette suivie : passer à une isolation par storageState (auth une fois, cookie réutilisé) pour restaurer le parallélisme.
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm run build && PORT=${PORT} npm run start`,
    url: `http://localhost:${PORT}/fr`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { PORT: String(PORT) },
  },
});
