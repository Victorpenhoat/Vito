"use client";
import { useTranslations } from "next-intl";
import { useCaptureError } from "@/features/shared/ui/useCaptureError";

export default function HotelsError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("hotels.error");
  useCaptureError(error, "hotels");
  return (
    <main className="p-6">
      <p role="alert" data-testid="error-boundary">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
