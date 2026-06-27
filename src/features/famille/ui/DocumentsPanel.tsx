"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DocMeta } from "../data/queries";
import { DocumentRow } from "./DocumentRow";
import { DocumentPreview } from "./DocumentPreview";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

export function DocumentsPanel({ documents }: { documents: DocMeta[] }) {
  const t = useTranslations("famille");
  const [selected, setSelected] = useState<string | null>(documents[0]?.id ?? null);
  const current = documents.find((d) => d.id === selected) ?? documents[0] ?? null;
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>{t("fiche.documents")}</SectionLabel>
      {documents.length === 0 ? (
        <p className="text-muted">{t("fiche.aucunDocument")}</p>
      ) : (
        <div className="lg:grid lg:grid-cols-2 lg:gap-6">
          <ul className="flex flex-col gap-2">
            {documents.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => setSelected(d.id)} className="w-full text-left">
                  <DocumentRow doc={d} />
                </button>
              </li>
            ))}
          </ul>
          {current && <div className="hidden lg:block"><DocumentPreview doc={current} /></div>}
        </div>
      )}
    </section>
  );
}
