"use client";
import { useTranslations } from "next-intl";
import { useCaptureError } from "@/features/shared/ui/useCaptureError";
export default function AgenceError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("agence.error");
  useCaptureError(error, "agence");
  return (
    <main className="p-6">
      <p role="alert">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
