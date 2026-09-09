import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { ENTETES_STATIQUES } from "./src/lib/securite/entetes";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Documents Cercle : jusqu'à 2 faces × 10 Mo (validées côté action) + overhead
      // multipart. Le défaut Next (1 Mo) rejetait déjà les gros scans avant validation.
      bodySizeLimit: "25mb",
    },
  },
  images: {
    // Autorise next/image sur notre proxy photo same-origin (ref est une ref interne, jamais la clé API)
    localPatterns: [{ pathname: "/api/places/photo", search: "**" }],
  },
  // Les en-têtes qui ne dépendent pas de la requête. Ils sont posés ici et non
  // dans le proxy parce que le proxy ne voit ni /api ni les fichiers statiques,
  // et qu'un en-tête de sécurité qui a des trous n'en est pas un.
  // La CSP, elle, porte une nonce par requête : elle vit dans src/proxy.ts.
  async headers() {
    return [{ source: "/:chemin*", headers: [...ENTETES_STATIQUES] }];
  },
};
export default withNextIntl(nextConfig);
