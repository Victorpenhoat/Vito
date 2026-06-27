import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/features/shared/ui/Button";

export async function ProchesEmptyState() {
  const t = await getTranslations("famille");
  return (
    <div data-testid="proches-empty" className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface p-10 text-center">
      <p className="font-serif text-2xl text-ink">{t("proches.vide")}</p>
      <p className="max-w-sm text-muted">{t("proches.videTexte")}</p>
      <Link href="/famille/proches/nouveau"><Button>{t("proches.ajouter")}</Button></Link>
    </div>
  );
}
