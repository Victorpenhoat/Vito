"use client";
import { useTranslations } from "next-intl";

export default function VinsError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("vins.error");
  return (
    <main className="p-6">
      <p role="alert">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
