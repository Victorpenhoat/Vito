import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import type { DocMeta } from "../data/queries";
import { ExpiryBadge } from "./ExpiryBadge";
import { MaskedNumber } from "./MaskedNumber";
import { expiryStatus, monthsUntil } from "../domain/expiry";

// Ligne document de la fiche (design Onglet_Cercle, écran 2) : type + chip de
// validité, numéro masqué (révéler/copier) ; tap → détail du document.
export async function DocumentRow({ doc, memberId }: { doc: DocMeta; memberId: string }) {
  const t = await getTranslations("famille");
  const status = expiryStatus(doc.expiry_date, new Date());
  const label = doc.doc_label ?? t(`docTypes.${doc.doc_type}`);
  return (
    <li data-testid="document-row" className="flex items-center gap-3 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <Link
          href={`/famille/proches/${memberId}/documents/${doc.id}`}
          className="flex flex-wrap items-center gap-2 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="text-[13px] font-medium text-ink">{label}</span>
          {status && (
            <ExpiryBadge
              status={status}
              monthsLeft={doc.expiry_date ? monthsUntil(doc.expiry_date, new Date()) : undefined}
              year={status === "valid" && doc.expiry_date ? doc.expiry_date.slice(0, 4) : undefined}
            />
          )}
        </Link>
        {doc.doc_number_masque && (
          <div className="mt-1"><MaskedNumber docId={doc.id} masque={doc.doc_number_masque} /></div>
        )}
      </div>
      {!doc.doc_number_masque && (
        <Link
          href={`/famille/proches/${memberId}/documents/${doc.id}`}
          aria-label={label}
          className="shrink-0 text-faint focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronRight size={16} aria-hidden />
        </Link>
      )}
    </li>
  );
}
