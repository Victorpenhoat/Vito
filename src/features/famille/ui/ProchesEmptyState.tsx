import { Plus } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/features/shared/ui/Avatar";
import { Button } from "@/features/shared/ui/Button";

// État vide de la liste Cercle (design Onglet_Cercle, écran 7a) : cluster
// d'avatars (moi + deux inconnus) plutôt qu'une illustration lourde.
export async function ProchesEmptyState({ userName }: { userName?: string | null }) {
  const t = await getTranslations("famille");
  return (
    <div data-testid="proches-empty" className="flex flex-1 flex-col items-center justify-center gap-0 px-6 py-16 text-center">
      <div className="relative mb-6 h-[92px] w-[110px]">
        <span className="absolute left-0 top-[14px] grid h-[54px] w-[54px] place-items-center rounded-full border border-line bg-surface-hover text-base font-semibold text-faint">?</span>
        <span className="absolute right-0 top-[26px] grid h-[44px] w-[44px] place-items-center rounded-full border border-line bg-surface-hover text-sm font-semibold text-faint">?</span>
        <span className="absolute left-[38px] top-0 shadow-lg rounded-full">
          <Avatar name={userName ?? "?"} size="xl" color="#211E1A" />
        </span>
      </div>
      <h2 className="font-serif text-2xl font-medium text-ink">{t("proches.vide")}</h2>
      <p className="mt-2 mb-6 max-w-sm text-sm leading-relaxed text-muted">{t("proches.videTexte")}</p>
      <Link href="/famille/proches/nouveau">
        <Button className="inline-flex items-center gap-2 shadow-[0_6px_18px_rgba(37,99,235,.3)]">
          <Plus size={16} aria-hidden />
          {t("proches.ajouterPersonne")}
        </Button>
      </Link>
    </div>
  );
}
