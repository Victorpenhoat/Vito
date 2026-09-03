import { getTranslations, getLocale } from "next-intl/server";
import { requireRole } from "@/lib/rbac/guards";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { getComptesAdmin } from "@/features/compte/data/sessions";
import { ComptesTable } from "@/features/compte/ui/ComptesTable";
import { formatDay } from "@/lib/format/date";

// Écran « Comptes » (design Onboarding, rôles & administration).
// Réservé à l'administrateur — et volontairement limité aux ACCÈS : aucune
// fiche, aucun document, aucun voyage d'un autre compte n'y est accessible.
export default async function ComptesPage() {
  await requireRole(["admin"]);
  const t = await getTranslations("compte");
  const locale = await getLocale();
  const comptes = await getComptesAdmin();

  return (
    <main className="flex flex-col gap-6 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1000px]">
      <PageHeader eyebrow={t("comptes.eyebrow")} title={t("comptes.titre")} />
      <div data-testid="comptes-avertissement" className="rounded-[5px] border border-accent/25 bg-accent-50 px-3.5 py-3">
        <p className="text-[12.5px] text-ink">{t("comptes.gereLesAcces")}</p>
        <p className="mt-1 text-[11.5px] text-muted">{t("comptes.aucunContenu")}</p>
      </div>
      <ComptesTable
        comptes={comptes.map((c) => ({
          ...c,
          creeLe: c.created_at ? formatDay(c.created_at.slice(0, 10), locale) : "—",
          vuLe: c.derniere_connexion ? formatDay(c.derniere_connexion.slice(0, 10), locale) : null,
        }))}
      />
    </main>
  );
}
