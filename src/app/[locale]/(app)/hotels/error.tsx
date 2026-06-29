"use client";
import { useTranslations } from "next-intl";

export default function HotelsError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("hotels.error");
  return (
    <main className="p-6">
      <p role="alert" data-testid="error-boundary">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
