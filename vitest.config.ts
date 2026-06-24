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
  },
  resolve: {
    alias: [
      { find: "server-only", replacement: path.resolve(__dirname, "./src/test/mocks/server-only.ts") },
      { find: /^@\/lib\/supabase\/server$/, replacement: path.resolve(__dirname, "./src/test/mocks/lib-supabase-server.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
