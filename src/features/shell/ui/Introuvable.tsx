import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";

// Le contenu de la page 404, partagé par ses DEUX portes d'entrée :
//
// - `[locale]/not-found.tsx`, pour les `notFound()` des pages (fiche absente ou
//   appartenant à un autre compte) — c'est le 404 qu'un vrai lecteur rencontre ;
// - `global-not-found.tsx`, pour les URL qui ne correspondent à aucune route,
//   que Next traite au niveau du routage, hors de tout layout.
//
// Un seul lien, vers la racine : `[locale]/page.tsx` redirige déjà un
// utilisateur connecté vers /accueil et sert le panneau de connexion sinon. Le
// 404 n'a donc pas à deviner qui le lit.
export async function Introuvable() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">404</span>
      <h1 className="font-serif text-3xl text-ink">{t("titre")}</h1>
      <p className="text-[14px] leading-relaxed text-muted">{t("texte")}</p>
      <Link
        href="/"
        className="mt-2 rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-badge focus-visible:outline-2 focus-visible:outline-accent"
      >
        {t("retour")}
      </Link>
    </main>
  );
}
