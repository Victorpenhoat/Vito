"use client";
import { useTranslations } from "next-intl";
import type { DocMeta } from "../data/queries";

export function DocumentPreview({ doc }: { doc: DocMeta }) {
  const t = useTranslations("famille");
  const src = `/api/famille/documents/${doc.id}`;
  const isImage = doc.mime_type.startsWith("image/");
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t("fiche.apercu")}</span>
      {isImage ? (
        <img src={src} alt={t("fiche.apercu")} className="max-w-full rounded-card border border-line" />
      ) : (
        <iframe src={src} title={t("fiche.apercu")} className="h-[480px] w-full rounded-card border border-line" />
      )}
    </div>
  );
}
