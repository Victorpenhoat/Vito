import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");
const nextConfig: NextConfig = {
  images: {
    // Autorise next/image sur notre proxy photo same-origin (ref est une ref interne, jamais la clé API)
    localPatterns: [{ pathname: "/api/places/photo", search: "**" }],
  },
};
export default withNextIntl(nextConfig);
