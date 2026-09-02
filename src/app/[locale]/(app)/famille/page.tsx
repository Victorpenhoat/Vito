import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getProches } from "@/features/famille/data/queries";
import { CercleList } from "@/features/famille/ui/CercleList";
import { ProchesEmptyState } from "@/features/famille/ui/ProchesEmptyState";
import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";

// Onglet Cercle (design Onglet_Cercle, écran 1) : carnet de personnes.
// Le « Foyer partagé » (comptes) vit désormais sur /famille/foyer.
export default async function FamillePage() {
  const t = await getTranslations("famille");
  const proches = await getProches();

  let userName: string | null = null;
  if (proches.length === 0) {
    const auth = await getCachedUser();
    if (auth.user) {
      const supabase = await createServerSupabase();
      const { data } = await supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
      userName = data?.display_name ?? null;
    }
  }

  return (
    <main className="flex min-h-full flex-col gap-4 p-4 md:p-8">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("cercleTitre")}
        action={
          <Link
            href="/famille/proches/nouveau"
            aria-label={t("proches.ajouter")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white shadow-[0_6px_16px_rgba(37,99,235,.35)] transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Plus size={18} aria-hidden />
          </Link>
        }
      />
      {proches.length === 0 ? <ProchesEmptyState userName={userName} /> : <CercleList proches={proches} />}
    </main>
  );
}
