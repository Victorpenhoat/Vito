import { getTranslations } from "next-intl/server";
import { getVoyageDetail } from "../data/queries";
import { ReservationForm } from "./ReservationForm";
import { ShareForm } from "./ShareForm";
import { MembersList } from "./MembersList";
import { openVoyageGroupe } from "@/features/depenses/data/actions";

export async function VoyageDetail({ id }: { id: string }) {
  const t = await getTranslations("voyages");
  const { voyage, reservations, membres, isOwner } = await getVoyageDetail(id);
  return (
    <article className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold">{voyage.titre}</h1>
        <p className="text-gray-600">
          {[voyage.destination, t(`statuts.${voyage.statut}`), voyage.date_debut, voyage.date_fin].filter(Boolean).join(" · ")}
        </p>
      </header>

      <section>
        <h2 className="font-semibold">{t("reservations")}</h2>
        <ul className="flex flex-col gap-1">
          {reservations.map((r) => (
            <li key={r.id} data-testid="reservation-row" className="border-b py-1">
              <span className="font-medium">{t(`types.${r.type}`)}</span> {r.fournisseur ?? ""} {r.reference ?? ""}{" "}
              {r.conciergerie_tel && <a href={`tel:${r.conciergerie_tel}`} className="underline">{r.conciergerie_tel}</a>}{" "}
              {r.conciergerie_mail && <a href={`mailto:${r.conciergerie_mail}`} className="underline">{r.conciergerie_mail}</a>}{" "}
              {r.lien && <a href={r.lien} target="_blank" rel="noopener noreferrer" className="underline">{t("voirLien")}</a>}
            </li>
          ))}
        </ul>
        <ReservationForm voyageId={voyage.id} />
      </section>

      <section>
        <h2 className="font-semibold">{t("membres")}</h2>
        <MembersList voyageId={voyage.id} membres={membres} isOwner={isOwner} />
        {isOwner && <ShareForm voyageId={voyage.id} />}
      </section>

      <section>
        <form action={openVoyageGroupe}>
          <input type="hidden" name="voyageId" value={voyage.id} />
          <button type="submit" className="underline">{t("ouvrirCompte")}</button>
        </form>
      </section>
    </article>
  );
}
