import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Skeleton } from "@/features/shared/ui/Skeleton";

export default async function FamilleLoading() {
  const t = await getTranslations("famille");
  return (
    <main className="flex flex-col gap-8 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("proches.titre")} />
      <section className="flex flex-col gap-4">
        <SectionLabel>{t("proches.titre")}</SectionLabel>
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
              <Skeleton className="h-[46px] w-[46px] rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
