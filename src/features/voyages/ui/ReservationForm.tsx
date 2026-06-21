"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addReservation } from "../data/actions";
import { RESERVATION_TYPES } from "../domain/schemas";

export function ReservationForm({ voyageId }: { voyageId: string }) {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(addReservation, undefined);
  return (
    <form action={action} data-testid="reservation-form" className="flex flex-col gap-2 border-t pt-3">
      <input type="hidden" name="voyageId" value={voyageId} />
      <select name="type" aria-label={t("type")} className="border p-2" defaultValue="hotel">
        {RESERVATION_TYPES.map((ty) => <option key={ty} value={ty}>{t(`types.${ty}`)}</option>)}
      </select>
      <input name="fournisseur" placeholder={t("fournisseur")} className="border p-2" />
      <input name="reference" placeholder={t("reference")} className="border p-2" />
      <div className="flex gap-2">
        <input name="dateDebut" type="date" aria-label={t("dateDebut")} className="border p-2" />
        <input name="dateFin" type="date" aria-label={t("dateFin")} className="border p-2" />
      </div>
      <input name="conciergerieTel" placeholder={t("conciergerieTel")} className="border p-2" />
      <input name="conciergerieMail" type="email" placeholder={t("conciergerieMail")} className="border p-2" />
      <input name="lien" type="url" placeholder={t("lien")} className="border p-2" />
      <textarea name="notes" placeholder={t("notes")} className="border p-2" />
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("addReservation")}</button>
    </form>
  );
}
