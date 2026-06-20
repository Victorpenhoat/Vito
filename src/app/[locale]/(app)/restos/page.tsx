// Stub — remplacé par le module Restos complet en Task 19.
import { getTranslations } from "next-intl/server";

export default async function RestosPage() {
  const t = await getTranslations("restos");
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
    </main>
  );
}
