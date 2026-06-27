"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DocMeta } from "../data/queries";
import { DocTypeIcon } from "./DocTypeIcon";
import { ExpiryBadge } from "./ExpiryBadge";
import { maskDocNumber } from "../domain/mask";
import { expiryStatus, monthsUntil } from "../domain/expiry";

export function DocumentRow({ doc }: { doc: DocMeta }) {
  const t = useTranslations("famille");
  const [revealed, setRevealed] = useState(false);
  const status = expiryStatus(doc.expiry_date, new Date());
  return (
    <li data-testid="document-row" className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
      <DocTypeIcon docType={doc.doc_type} />
      <div className="flex-1 min-w-0">
        <div className="text-ink">{t(`docTypes.${doc.doc_type}`)}</div>
        {doc.doc_number && (
          <button type="button" onClick={() => setRevealed((v) => !v)} aria-label={t("fiche.revelerNumero")} className="text-sm text-muted tabular-nums">
            {revealed ? doc.doc_number : maskDocNumber(doc.doc_number)}
          </button>
        )}
      </div>
      {status && status !== "valid" && <ExpiryBadge status={status} monthsLeft={doc.expiry_date ? monthsUntil(doc.expiry_date, new Date()) : undefined} />}
      <a href={`/api/famille/documents/${doc.id}`} target="_blank" rel="noopener" className="text-sm font-medium text-accent">{t("fiche.voirDocument")}</a>
    </li>
  );
}
