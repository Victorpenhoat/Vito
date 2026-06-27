"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DocMeta } from "../data/queries";
import { DocumentRow } from "./DocumentRow";
import { DocumentPreview } from "./DocumentPreview";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { AjouterDocumentButton } from "./AjouterDocumentButton";

export function DocumentsPanel({ documents, memberId }: { documents: DocMeta[]; memberId: string }) {
  const t = useTranslations("famille");
  const [selected, setSelected] = useState<string | null>(documents[0]?.id ?? null);
  const current = documents.find((d) => d.id === selected) ?? documents[0] ?? null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionLabel>{t("fiche.documents")}</SectionLabel>
        <AjouterDocumentButton memberId={memberId} />
      </div>
      {documents.length === 0 ? (
        <p className="text-muted">{t("fiche.aucunDocument")}</p>
      ) : (
        <div className="lg:grid lg:grid-cols-2 lg:gap-6">
          <ul className="flex flex-col gap-2">
            {documents.map((d) => (
              <DocumentRow key={d.id} doc={d} selected={selected === d.id} onSelect={() => setSelected(d.id)} />
            ))}
          </ul>
          {current && <div className="hidden lg:block"><DocumentPreview doc={current} /></div>}
        </div>
      )}
    </section>
  );
}
