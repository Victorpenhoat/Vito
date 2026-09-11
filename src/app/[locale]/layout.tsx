import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Inter, Newsreader } from "next/font/google";
import { routing } from "@/lib/i18n/routing";
import { themeServeur } from "@/lib/platform/theme";
import { PwaRegister } from "./pwa-register";
import { LiensProfonds } from "@/features/shell/ui/LiensProfonds";
import { SentryClientInit } from "@/lib/observability/sentryClient";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  // Le fond du carnet, pas un gris arbitraire : c'est cette couleur que
  // remplissent la barre d'état iOS et la barre d'onglets Android autour de
  // l'app. Valeur du thème SOMBRE, qui est le défaut ; notre thème vient d'un
  // cookie et non du réglage système, donc un `themeColor` discriminé par
  // `media` ne le suivrait pas. Le lecteur qui choisit le clair garde donc une
  // barre sombre — écart assumé, cf. le spec du lot 0.
  themeColor: "#080D16",
  // La page occupe l'écran entier, encoche et barre home comprises. Sans cela,
  // iOS laisse deux bandes de la couleur du fond et l'app ressemble à une page
  // web posée dans un cadre. Les retraits sont rendus aux éléments qui en ont
  // besoin par `env(safe-area-inset-*)`.
  viewportFit: "cover",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Défaut et lecture du cookie : voir `src/lib/platform/theme.ts`, partagé
  // avec `global-not-found.tsx` qui contourne ce layout.
  const theme = await themeServeur();
  return (
    <html lang={locale} data-theme={theme} className={`${inter.variable} ${newsreader.variable}`}>
      <body>
        <NextIntlClientProvider>
          <PwaRegister />
          {/* Coque iOS : les liens que le système remet à l'app (sans effet sur le web). */}
          <LiensProfonds />
          <SentryClientInit />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
