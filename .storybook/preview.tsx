import type { Preview } from "@storybook/nextjs-vite";
import React from "react";
import { Inter, Newsreader } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import "../src/app/globals.css";
import { storyMessages } from "./messages";

// Mêmes fonts que l'app (src/app/[locale]/layout.tsx) — next/font supporté par nextjs-vite.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader" });

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
  },
  globalTypes: {
    theme: {
      description: "Thème",
      defaultValue: "dark",
      toolbar: { icon: "circlehollow", items: ["dark", "light"], dynamicTitle: true },
    },
  },
  decorators: [
    (Story, ctx) => {
      const theme = (ctx.globals.theme as string) ?? "dark";
      return (
        <NextIntlClientProvider locale="fr" messages={storyMessages}>
          <div
            data-theme={theme}
            className={`${inter.variable} ${newsreader.variable}`}
            // font-family explicite : Tailwind v4 tree-shake la var @theme `--font-sans` dans le
            // build Storybook (référencée seulement en CSS brut). On reprend son stack résolu, basé
            // sur --font-inter que next/font fournit de façon fiable (cf. classes .variable ci-dessus).
            style={{ background: "var(--app)", color: "var(--ink)", fontFamily: "var(--font-inter), system-ui, sans-serif", minHeight: "100vh", padding: 24 }}
          >
            <Story />
          </div>
        </NextIntlClientProvider>
      );
    },
  ],
};

export default preview;
