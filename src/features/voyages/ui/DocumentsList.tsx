"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { supprimerDocument } from "../data/documents";

type Doc = { id: string; nom: string; mime_type: string; taille: number; created_at: string };

function ko(taille: number): string {
  return `${Math.max(1, Math.round(taille / 1024))} Ko`;
}

export function DocumentsList({ voyageId, documents }: { voyageId: string; documents: Doc[] }) {
  const t = useTranslations("voyages.documents");
  const [, supprimer] = useActionState(supprimerDocument, undefined);
  if (documents.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {documents.map((d) => (
        <li key={d.id} data-testid="document-row" className="flex items-center gap-2 border-b py-1">
          <span className="flex-1">{d.nom} <span className="text-gray-500 text-sm">({ko(d.taille)})</span></span>
          <a href={`/api/voyages/documents/${d.id}`} className="underline text-sm" download>{t("telecharger")}</a>
          <form action={supprimer}>
            <input type="hidden" name="documentId" value={d.id} />
            <input type="hidden" name="voyageId" value={voyageId} />
            <button type="submit" className="underline text-sm">{t("supprimer")}</button>
          </form>
        </li>
      ))}
    </ul>
  );
}
