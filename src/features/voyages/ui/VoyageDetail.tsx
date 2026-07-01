import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { formatRange } from "@/lib/format/date";
import { getVoyageDetail, getVoyageDocuments } from "../data/queries";
import { statutTint } from "../domain/statutTint";
import { ReservationForm } from "./ReservationForm";
import { ShareForm } from "./ShareForm";
import { MembersList } from "./MembersList";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { DocumentsList } from "./DocumentsList";
import { openVoyageGroupe } from "@/features/depenses/data/actions";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

export async function VoyageDetail({ id }: { id: string }) {
  const t = await getTranslations("voyages");
  const locale = await getLocale();
  const detail = await getVoyageDetail(id);
  if (!detail) notFound();
  const { voyage, reservations, membres, isOwner } = detail;
  const documents = await getVoyageDocuments(voyage.id);
  const dates = formatRange(voyage.date_debut, voyage.date_fin, locale);
  const sub = [voyage.destination, dates].filter(Boolean).join(" · ");
  return (
    <article className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-card">
        <div className="h-44 md:h-56" style={{ background: statutTint(voyage.statut) }} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5 text-white">
          <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]">{t(`statuts.${voyage.statut}`)}</span>
          <h1 className="mt-2 font-serif text-3xl font-medium md:text-4xl">{voyage.titre}</h1>
          {sub && <p className="mt-1 text-sm opacity-90">{sub}</p>}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <section>
            <SectionLabel>{t("reservations")}</SectionLabel>
            <ul className="flex flex-col">
              {reservations.map((r) => (
                <li key={r.id} data-testid="reservation-row" className="flex flex-col gap-0.5 border-b border-line-soft py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{t(`types.${r.type}`)}</span>
                  <span className="font-serif text-lg text-ink">{[r.fournisseur, r.reference].filter(Boolean).join(" · ") || t(`types.${r.type}`)}</span>
                  {(r.date_debut || r.date_fin) && <span className="text-sm text-muted">{formatRange(r.date_debut, r.date_fin, locale)}</span>}
                  <span className="flex flex-wrap gap-3 text-sm">
                    {r.conciergerie_tel && <a href={`tel:${r.conciergerie_tel}`} className="text-accent hover:underline">{r.conciergerie_tel}</a>}
                    {r.conciergerie_mail && <a href={`mailto:${r.conciergerie_mail}`} className="text-accent hover:underline">{r.conciergerie_mail}</a>}
                    {r.lien && <a href={r.lien} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{t("voirLien")}</a>}
                  </span>
                </li>
              ))}
            </ul>
            <ReservationForm voyageId={voyage.id} />
          </section>

          <section data-testid="documents-section">
            <SectionLabel>{t("documents.titre")}</SectionLabel>
            <DocumentsList voyageId={voyage.id} documents={documents} />
            <DocumentUploadForm voyageId={voyage.id} />
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <SectionLabel>{t("membres")}</SectionLabel>
            <MembersList voyageId={voyage.id} membres={membres} isOwner={isOwner} />
            {isOwner && <ShareForm voyageId={voyage.id} />}
          </Card>
          <Card>
            <SectionLabel>{t("depenses")}</SectionLabel>
            <form action={openVoyageGroupe}>
              <input type="hidden" name="voyageId" value={voyage.id} />
              <button type="submit" className="text-sm font-semibold text-accent hover:underline">{t("ouvrirCompte")}</button>
            </form>
          </Card>
        </aside>
      </div>
    </article>
  );
}
