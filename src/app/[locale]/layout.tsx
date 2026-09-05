import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Inter, Newsreader } from "next/font/google";
import { cookies } from "next/headers";
import { routing } from "@/lib/i18n/routing";
import { PwaRegister } from "./pwa-register";
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
  themeColor: "#111111",
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
  const cookieStore = await cookies();
  // Le CLAIR est le défaut : toutes les maquettes (docs/design/*.dc.html) sont
  // claires, sans une seule variante sombre. Un visiteur qui découvre Vito doit
  // voir ce qui a été dessiné ; le sombre reste à un clic, et le choix est
  // mémorisé par le cookie.
  const theme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang={locale} data-theme={theme} className={`${inter.variable} ${newsreader.variable}`}>
      <body>
        <NextIntlClientProvider>
          <PwaRegister />
          <SentryClientInit />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
