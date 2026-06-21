import { getTranslations } from "next-intl/server";
import { getGouts } from "../data/queries";
import { Link } from "@/lib/i18n/routing";

// Bandeau non bloquant : affiché seulement si l'utilisateur n'a pas encore de profil de goûts.
export async function GoutsBanner() {
  const gouts = await getGouts();
  if (gouts) return null;
  const t = await getTranslations("gouts");
  return (
    <div data-testid="gouts-banner" className="flex items-center justify-between gap-3 border rounded p-3 bg-amber-50">
      <span>{t("banner")}</span>
      <span className="flex gap-3">
        <Link href="/gouts" className="underline">{t("bannerCta")}</Link>
        <Link href="/recherche" className="underline">{t("bannerSearch")}</Link>
      </span>
    </div>
  );
}
