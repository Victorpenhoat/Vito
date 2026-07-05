"use client";
import { useTranslations } from "next-intl";
import { useCaptureError } from "@/features/shared/ui/useCaptureError";
export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("admin.error");
  useCaptureError(error, "admin");
  return (
    <main className="p-6">
      <p role="alert">{t("title")}</p>
      <button onClick={reset} className="underline">{t("retry")}</button>
    </main>
  );
}
