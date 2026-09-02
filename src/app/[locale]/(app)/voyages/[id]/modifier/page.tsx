import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getVoyageDetail } from "@/features/voyages/data/queries";
import { VoyageForm } from "@/features/voyages/ui/VoyageForm";
import { DeleteVoyageButton } from "@/features/voyages/ui/DeleteVoyageButton";

export default async function ModifierVoyagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("voyages");
  const detail = await getVoyageDetail(id);
  if (!detail) notFound();
  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <Link href={`/voyages/${id}`} className="inline-flex items-center gap-1 py-1.5 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">
          <ChevronLeft size={16} aria-hidden />
          {t("annuler")}
        </Link>
        <span className="text-[15px] font-semibold text-ink">{t("modifierTitre")}</span>
        <span className="w-16" aria-hidden />
      </div>
      <VoyageForm mode="edit" initial={detail.voyage} />
      {detail.isOwner && (
        <div className="max-w-md border-t border-line pt-4">
          <DeleteVoyageButton id={id} label={t("supprimer")} confirmMsg={t("confirmSuppr")} />
        </div>
      )}
    </main>
  );
}
