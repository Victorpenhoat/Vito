"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addReservation } from "../data/actions";
import { RESERVATION_TYPES } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";

export function ReservationForm({ voyageId }: { voyageId: string }) {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(addReservation, undefined);
  return (
    <form action={action} data-testid="reservation-form" className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="voyageId" value={voyageId} />
      <select name="type" aria-label={t("type")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" defaultValue="hotel">
        {RESERVATION_TYPES.map((ty) => <option key={ty} value={ty}>{t(`types.${ty}`)}</option>)}
      </select>
      <input name="fournisseur" placeholder={t("fournisseur")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <input name="reference" placeholder={t("reference")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <div className="flex gap-2">
        <input name="dateDebut" type="date" aria-label={t("dateDebut")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
        <input name="dateFin" type="date" aria-label={t("dateFin")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      </div>
      <input name="conciergerieTel" placeholder={t("conciergerieTel")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <input name="conciergerieMail" type="email" placeholder={t("conciergerieMail")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <input name="lien" type="url" placeholder={t("lien")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <textarea name="notes" placeholder={t("notes")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("addReservation")}</Button>
    </form>
  );
}
