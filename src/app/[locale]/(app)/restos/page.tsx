import { getTranslations } from "next-intl/server";
import { RestoSearch } from "@/features/restos/ui/RestoSearch";
import { RestoList } from "@/features/restos/ui/RestoList";

export default async function RestosPage() {
  const t = await getTranslations("restos");
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <RestoSearch />
      <RestoList />
    </main>
  );
}
