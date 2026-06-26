"use client";
import { useTranslations } from "next-intl";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RestoError({ reset }: ErrorProps) {
  const t = useTranslations("restos.error");
  return (
    <main className="p-6 flex flex-col gap-4">
      <h1 className="text-xl font-bold text-danger">{t("title")}</h1>
      <button onClick={reset} className="underline self-start">{t("retry")}</button>
    </main>
  );
}
