import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getProche } from "@/features/famille/data/queries";
import { DocumentMetaForm } from "@/features/famille/ui/DocumentMetaForm";

export default async function ModifierDocumentPage({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const t = await getTranslations("famille");
  const data = await getProche(id);
  if (!data) notFound();
  const doc = data.documents.find((d) => d.id === docId);
  if (!doc) notFound();
  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <Link href={`/famille/proches/${id}/documents/${docId}`} className="inline-flex items-center gap-1 py-1.5 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">
          <ChevronLeft size={16} aria-hidden />
          {t("form.annuler")}
        </Link>
        <span className="text-[15px] font-semibold text-ink">{t("doc.modifierTitre")}</span>
        <span className="w-16" aria-hidden />
      </div>
      <DocumentMetaForm doc={doc} />
    </main>
  );
}
