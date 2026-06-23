import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";

export default async function AccueilPage() {
  const t = await getTranslations("accueil");
  return (
    <main data-testid="accueil" className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t("welcome")}</h1>
      <Link href="/restos" className="text-accent hover:underline">{t("cta")}</Link>
    </main>
  );
}
