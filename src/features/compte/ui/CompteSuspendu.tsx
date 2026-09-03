import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { signOut } from "@/features/auth/data/actions";

// Accès suspendu par un administrateur. Aucun contenu du carnet n'est rendu :
// le ton reste factuel et donne la marche à suivre, sans dramatiser.
export async function CompteSuspendu() {
  const t = await getTranslations("compte");
  return (
    <main data-testid="compte-suspendu" className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <ShieldAlert size={28} className="text-kpi-amber" aria-hidden />
      <h1 className="text-[17px] font-semibold text-ink">{t("suspendu.titre")}</h1>
      <p className="text-[13px] text-muted">{t("suspendu.explication")}</p>
      <p className="text-[12px] text-faint">{t("suspendu.contenusIntacts")}</p>
      <form action={signOut}>
        <button type="submit" data-testid="suspendu-deconnexion"
          className="rounded-control border border-line bg-surface-hover px-3.5 py-2 text-xs font-semibold text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">
          {t("suspendu.seDeconnecter")}
        </button>
      </form>
    </main>
  );
}
