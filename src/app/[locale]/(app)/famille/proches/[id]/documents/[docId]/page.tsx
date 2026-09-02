import { notFound } from "next/navigation";
import { ChevronLeft, Maximize2 } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getProche } from "@/features/famille/data/queries";
import { ExpiryBadge } from "@/features/famille/ui/ExpiryBadge";
import { MaskedNumber } from "@/features/famille/ui/MaskedNumber";
import { ReminderToggle } from "@/features/famille/ui/ReminderToggle";
import { ShareScanButton } from "@/features/famille/ui/ShareScanButton";
import { DeleteDocumentButton } from "@/features/famille/ui/DeleteDocumentButton";
import { expiryStatus, monthsUntil } from "@/features/famille/domain/expiry";
import { formatDay } from "@/lib/format/date";

// Détail d'un document (design Onglet_Cercle, écran 3) : scans recto/verso,
// champs, rappel d'expiration, partage natif, suppression.
export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const t = await getTranslations("famille");
  const locale = await getLocale();
  const data = await getProche(id);
  if (!data) notFound();
  const doc = data.documents.find((d) => d.id === docId);
  if (!doc) notFound();

  const label = doc.doc_label ?? t(`docTypes.${doc.doc_type}`);
  const status = expiryStatus(doc.expiry_date, new Date());
  const holder = `${data.proche.first_name} ${data.proche.last_name}`;

  return (
    <main className="flex flex-col p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <div className="flex items-center justify-between">
        <Link href={`/famille/proches/${id}`} className="inline-flex items-center gap-1 py-1.5 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">
          <ChevronLeft size={16} aria-hidden />
          {data.proche.first_name}
        </Link>
        <Link href={`/famille/proches/${id}/documents/${docId}/modifier`} className="py-1.5 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">
          {t("fiche.modifier")}
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="font-serif text-2xl font-medium text-ink">{label}</h1>
        {status && (
          <ExpiryBadge status={status}
            monthsLeft={doc.expiry_date ? monthsUntil(doc.expiry_date, new Date()) : undefined}
            year={status === "valid" && doc.expiry_date ? doc.expiry_date.slice(0, 4) : undefined} />
        )}
      </div>
      <div className="mt-0.5 text-[12.5px] text-faint">{doc.holder_name ?? holder}</div>

      {/* scans recto / verso */}
      <div className={`mt-4 grid gap-2.5 ${doc.has_verso ? "grid-cols-2" : "grid-cols-1"}`}>
        <Scan docId={doc.id} mime={doc.mime_type} caption={t("doc.recto")} apercu={t("fiche.apercu")} voirLabel={t("fiche.voirDocument")} />
        {doc.has_verso && (
          <Scan docId={doc.id} face="verso" mime={doc.mime_type} caption={t("doc.verso")} apercu={t("doc.verso")} voirLabel={t("fiche.voirDocument")} />
        )}
      </div>

      {/* champs */}
      <div className="mt-4 overflow-hidden rounded-[5px] border border-line bg-surface">
        {doc.doc_number && (
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-faint">{t("doc.numero")}</div>
              <div className="mt-0.5"><MaskedNumber number={doc.doc_number} /></div>
            </div>
          </div>
        )}
        {(doc.issue_date || doc.expiry_date) && (
          <div className="grid grid-cols-2 border-b border-line-soft">
            <div className="border-r border-line-soft px-3.5 py-3">
              <div className="text-[11px] text-faint">{t("doc.emission")}</div>
              <div className="mt-0.5 text-sm text-ink">{doc.issue_date ? formatDay(doc.issue_date, locale) : "—"}</div>
            </div>
            <div className="px-3.5 py-3">
              <div className="text-[11px] text-faint">{t("doc.expiration")}</div>
              <div className={`mt-0.5 text-sm ${status === "expired" ? "font-semibold text-danger" : status === "soon" ? "font-semibold text-kpi-amber" : "text-ink"}`}>
                {doc.expiry_date ? formatDay(doc.expiry_date, locale) : "—"}
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2">
          <div className="border-r border-line-soft px-3.5 py-3">
            <div className="text-[11px] text-faint">{t("doc.autorite")}</div>
            <div className="mt-0.5 text-sm text-ink">{doc.issue_place ?? "—"}</div>
          </div>
          <div className="px-3.5 py-3">
            <div className="text-[11px] text-faint">{t("doc.pays")}</div>
            <div className="mt-0.5 text-sm text-ink">{doc.country ?? "—"}</div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <ReminderToggle docId={doc.id} initial={doc.reminder} />
      </div>

      <div className="mt-4 flex gap-2.5">
        <ShareScanButton docId={doc.id} label={label} mimeType={doc.mime_type} />
        <DeleteDocumentButton id={doc.id} label={t("form.supprimer")} confirmMsg={t("doc.supprimerConfirm")} />
      </div>
    </main>
  );
}

function Scan({ docId, face, mime, caption, apercu, voirLabel }: {
  docId: string; face?: "verso"; mime: string; caption: string; apercu: string; voirLabel: string;
}) {
  const src = `/api/famille/documents/${docId}${face ? "?face=verso" : ""}`;
  const isImage = mime.startsWith("image/");
  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-[6px] border border-line bg-badge">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- route privée no-store, incompatible next/image
          <img src={src} alt={apercu} className="h-[180px] w-full object-cover" />
        ) : (
          <iframe src={src} title={apercu} className="h-[180px] w-full" />
        )}
        <a href={src} target="_blank" rel="noopener" aria-label={voirLabel}
          className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-surface/90 text-muted shadow focus-visible:outline-2 focus-visible:outline-accent">
          <Maximize2 size={13} aria-hidden />
        </a>
      </div>
      <figcaption className="mt-1.5 text-center text-[11px] text-faint">{caption}</figcaption>
    </figure>
  );
}
