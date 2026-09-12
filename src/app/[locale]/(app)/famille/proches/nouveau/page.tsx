import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { ProcheForm } from "@/features/famille/ui/ProcheForm";

export default async function NouveauProchePage({
  searchParams,
}: {
  searchParams: Promise<{ prenom?: string }>;
}) {
  const { prenom } = await searchParams;
  const t = await getTranslations("famille");
  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <Link href="/famille" className="inline-flex items-center gap-1 py-1.5 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">
          <ChevronLeft size={16} aria-hidden />
          {t("form.annuler")}
        </Link>
        <span className="text-[15px] font-semibold text-ink">{t("proches.nouveauTitre")}</span>
        <span className="w-16" aria-hidden />
      </div>
      {/* L'autre chemin d'ajout : la personne a déjà un compte Vito et on se
          relie, au lieu de saisir une fiche de plus (migration 00067). */}
      <p className="max-w-md text-[12.5px] text-muted">
        {t("lien.depuisFormulaire")}{" "}
        <Link href="/famille/lier" data-testid="vers-lier-compte" className="font-semibold text-accent hover:underline">
          {t("lien.depuisFormulaireCta")}
        </Link>
      </p>
      <ProcheForm mode="create" initialFirstName={prenom?.trim() || undefined} />
    </main>
  );
}
