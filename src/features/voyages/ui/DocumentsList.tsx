"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { supprimerDocument } from "../data/documents";

type Doc = { id: string; nom: string; mime_type: string; taille: number; created_at: string; reservation_id?: string | null };

function ko(taille: number): string {
  return `${Math.max(1, Math.round(taille / 1024))} Ko`;
}

export function DocumentsList({ voyageId, documents, libellesReservations = {} }: {
  voyageId: string;
  documents: Doc[];
  /** Libellé de la réservation à laquelle un document est rattaché (Lot C) :
   *  la liste complète reste la référence, mais on dit d'où vient chaque pièce. */
  libellesReservations?: Record<string, string>;
}) {
  const t = useTranslations("voyages.documents");
  const [, supprimer] = useActionState(supprimerDocument, undefined);
  if (documents.length === 0) return <p className="text-muted">{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {documents.map((d) => (
        <li key={d.id} data-testid="document-row" className="flex items-center gap-2 border-b border-line py-1">
          <span className="flex-1">
            {d.nom} <span className="text-faint text-sm">({ko(d.taille)})</span>
            {d.reservation_id && libellesReservations[d.reservation_id] && (
              <span data-testid="document-rattache" className="ml-1.5 rounded-full border border-accent/25 bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {t("rattache", { libelle: libellesReservations[d.reservation_id] ?? "" })}
              </span>
            )}
          </span>
          <a href={`/api/voyages/documents/${d.id}`} className="text-accent hover:underline text-sm" download>{t("telecharger")}</a>
          <form action={supprimer}>
            <input type="hidden" name="documentId" value={d.id} />
            <input type="hidden" name="voyageId" value={voyageId} />
            <button type="submit" className="text-accent hover:underline text-sm">{t("supprimer")}</button>
          </form>
        </li>
      ))}
    </ul>
  );
}
