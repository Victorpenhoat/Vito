import { getTranslations } from "next-intl/server";
import { getVoyageDetail, getVoyageDocuments } from "../data/queries";
import { ReservationForm } from "./ReservationForm";
import { ShareForm } from "./ShareForm";
import { MembersList } from "./MembersList";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { DocumentsList } from "./DocumentsList";
import { openVoyageGroupe } from "@/features/depenses/data/actions";
import { Card } from "@/features/shared/ui/Card";
import { Badge } from "@/features/shared/ui/Badge";

export async function VoyageDetail({ id }: { id: string }) {
  const t = await getTranslations("voyages");
  const { voyage, reservations, membres, isOwner } = await getVoyageDetail(id);
  const documents = await getVoyageDocuments(voyage.id);
  return (
    <article className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">{voyage.titre}</h1>
        <p className="mt-1 flex items-center gap-2 text-muted">
          <span>{[voyage.destination, voyage.date_debut, voyage.date_fin].filter(Boolean).join(" · ")}</span>
          <Badge>{t(`statuts.${voyage.statut}`)}</Badge>
        </p>
      </header>

      <Card>
        <h2 className="font-semibold mb-2">{t("reservations")} <Badge>{reservations.length}</Badge></h2>
        <ul className="flex flex-col gap-1">
          {reservations.map((r) => (
            <li key={r.id} data-testid="reservation-row" className="border-b border-line py-1">
              <span className="font-medium">{t(`types.${r.type}`)}</span> {r.fournisseur ?? ""} {r.reference ?? ""}{" "}
              {r.conciergerie_tel && <a href={`tel:${r.conciergerie_tel}`} className="text-accent hover:underline">{r.conciergerie_tel}</a>}{" "}
              {r.conciergerie_mail && <a href={`mailto:${r.conciergerie_mail}`} className="text-accent hover:underline">{r.conciergerie_mail}</a>}{" "}
              {r.lien && <a href={r.lien} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{t("voirLien")}</a>}
            </li>
          ))}
        </ul>
        <ReservationForm voyageId={voyage.id} />
      </Card>

      <Card>
        <h2 className="font-semibold mb-2">{t("membres")} <Badge>{membres.length}</Badge></h2>
        <MembersList voyageId={voyage.id} membres={membres} isOwner={isOwner} />
        {isOwner && <ShareForm voyageId={voyage.id} />}
      </Card>

      <section>
        <form action={openVoyageGroupe}>
          <input type="hidden" name="voyageId" value={voyage.id} />
          <button type="submit" className="text-accent hover:underline">{t("ouvrirCompte")}</button>
        </form>
      </section>
      <section data-testid="documents-section" className="rounded-card border border-line bg-surface p-5">
        <h2 className="font-semibold mb-2">{t("documents.titre")} <Badge>{documents.length}</Badge></h2>
        <DocumentsList voyageId={voyage.id} documents={documents} />
        <DocumentUploadForm voyageId={voyage.id} />
      </section>
    </article>
  );
}
