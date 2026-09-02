import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getProche } from "@/features/famille/data/queries";
import { DocumentTunnel } from "@/features/famille/ui/DocumentTunnel";

export default async function NouveauDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("famille");
  const data = await getProche(id);
  if (!data) notFound();
  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <Link href={`/famille/proches/${id}`} className="inline-flex items-center gap-1 py-1.5 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">
          <ChevronLeft size={16} aria-hidden />
          {t("form.annuler")}
        </Link>
        <span className="text-[15px] font-semibold text-ink">{t("tunnel.titre")}</span>
        <span className="w-16" aria-hidden />
      </div>
      <div className="lg:mx-auto lg:w-full lg:max-w-[880px] lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-8 lg:shadow-lg">
        <DocumentTunnel memberId={id} />
      </div>
    </main>
  );
}
