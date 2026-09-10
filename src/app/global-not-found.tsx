import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { Inter, Newsreader } from "next/font/google";
import { Introuvable } from "@/features/shell/ui/Introuvable";
import "./globals.css";

// 404 des URL qui ne correspondent à AUCUNE route. Next les traite au niveau du
// routage : `[locale]/not-found.tsx` ne les voit jamais, et sans cette page
// c'est le 404 par défaut de Next qui répondait — en anglais, et surtout
// PRÉRENDU EN STATIQUE, donc sans nonce : sous 'strict-dynamic', ses dix
// scripts étaient bloqués et chaque visite émettait autant de rapports.
//
// `force-dynamic` est ce qui règle cela : sans lui, cette page est prérendue au
// build, où il n'existe ni requête ni nonce à y poser. Mesuré : la route passe
// de `○ Static` à `ƒ Dynamic` et ses dix scripts portent la nonce.
export const dynamic = "force-dynamic";

// La page contourne le layout : elle doit porter elle-même sa coque HTML, ses
// polices et ses styles. Rien d'autre — ni service worker, ni liens profonds,
// ni Sentry : une page d'erreur n'a pas à embarquer la machinerie de l'app.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

export default async function GlobalNotFound() {
  // La locale vient du proxy next-intl (`x-next-intl-locale`), qui l'a lue dans
  // l'URL : /en/nimportequoi rend bien un 404 anglais.
  const locale = await getLocale();
  const theme = (await cookies()).get("theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang={locale} data-theme={theme} className={`${inter.variable} ${newsreader.variable}`}>
      <body>
        {/* Le provider aussi est à reposer : le lien de retour est le composant
            client de next-intl, et sans contexte il jette « No intl context ». */}
        <NextIntlClientProvider>
          <Introuvable />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
