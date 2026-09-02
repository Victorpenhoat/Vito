import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
};
export default withNextIntl(nextConfig);
