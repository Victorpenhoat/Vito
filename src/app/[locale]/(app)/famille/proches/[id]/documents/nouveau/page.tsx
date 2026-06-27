import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProche } from "@/features/famille/data/queries";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { DocumentTunnel } from "@/features/famille/ui/DocumentTunnel";

export default async function NouveauDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("famille");
  const data = await getProche(id);
  if (!data) notFound();
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("tunnel.titre")} />
      <div className="lg:mx-auto lg:max-w-[880px] lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-8 lg:shadow-lg">
        <DocumentTunnel memberId={id} />
      </div>
    </main>
  );
}
