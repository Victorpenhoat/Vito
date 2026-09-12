import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getProches } from "@/features/famille/data/queries";
import { LierCompteEcran } from "@/features/famille/ui/LierCompteEcran";

// Se lier à quelqu'un qui a DÉJÀ un compte Vito (migration 00067). L'autre
// chemin — inviter un proche à s'en créer un — reste sur sa fiche.
export default async function LierPage() {
  const t = await getTranslations("famille");
  const locale = await getLocale();
  const proches = await getProches();
  // Une fiche déjà rattachée à un compte n'a plus rien à lier ; « moi » non plus.
  const fiches = proches
    .filter((p) => !p.profile_id && p.relation !== "moi")
    .map((p) => ({ id: p.id, first_name: p.first_name, last_name: p.last_name }));

  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <Link href="/famille" className="inline-flex items-center gap-1 py-1.5 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">
          <ChevronLeft size={16} aria-hidden />
          {t("form.annuler")}
        </Link>
        <span className="text-[15px] font-semibold text-ink">{t("lien.titre")}</span>
        <span className="w-16" aria-hidden />
      </div>
      <LierCompteEcran fiches={fiches} locale={locale} />
    </main>
  );
}
