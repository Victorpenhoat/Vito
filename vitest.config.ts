import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
    server: {
      deps: {
        inline: ["next-intl"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // next-intl est inliné (server.deps.inline) pour résoudre son ESM sous Vitest ;
      // sa chaîne d'imports (createNavigation → next/navigation) ne résout pas le
      // specifier nu « next/navigation » sans extension → on pointe le vrai re-export CJS.
      "next/navigation": path.resolve(__dirname, "node_modules/next/navigation.js"),
    },
  },
});
