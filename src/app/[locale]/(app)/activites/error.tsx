"use client";
import { useTranslations } from "next-intl";
import { useCaptureError } from "@/features/shared/ui/useCaptureError";

export default function ActivitesError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("activites.erreur");
  useCaptureError(error, "activites");
  return (
    <main className="flex flex-col items-start gap-2 p-6">
      <p role="alert" className="text-[14px] text-ink">{t("titre")}</p>
      <button onClick={reset} className="text-[13px] font-semibold text-accent underline">{t("reessayer")}</button>
    </main>
  );
}
