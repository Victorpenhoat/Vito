import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getTagsAvecUsage } from "@/features/restos/data/queries";
import { TagsAdmin } from "@/features/restos/ui/TagsAdmin";

export default async function TagsPage() {
  const t = await getTranslations("restos");
  const tags = await getTagsAvecUsage();
  return (
    <main className="flex flex-col gap-5 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <div className="flex items-center justify-between">
        <Link href="/restos" className="inline-flex items-center gap-1 py-1.5 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">
          <ChevronLeft size={16} aria-hidden />
          {t("title")}
        </Link>
        <span className="text-[15px] font-semibold text-ink">{t("tags.titre")}</span>
        <span className="w-16" aria-hidden />
      </div>
      <TagsAdmin tags={tags} />
    </main>
  );
}
