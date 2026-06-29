// Provider de preview pour design-sync. Le bundle des décorateurs .storybook
// échoue (globals.css → @import "tailwindcss", non résoluble par esbuild), donc
// on fournit le contexte via cfg.provider. Ce composant MIROIR le décorateur de
// .storybook/preview.tsx : NextIntlClientProvider (locale fr + messages mock) +
// wrapper [data-theme="dark"] avec fond/texte/typo, pour que les previews
// matchent le rendu du storybook de référence (l'oracle de compare).
import "./process-shim"; // DOIT rester en premier (définit process avant next-intl)
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { storyMessages } from "../.storybook/messages";

export function VitoPreviewProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="fr" messages={storyMessages}>
      <div
        data-theme="dark"
        style={{
          background: "var(--app)",
          color: "var(--ink)",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          minHeight: "100vh",
          padding: 24,
        }}
      >
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
