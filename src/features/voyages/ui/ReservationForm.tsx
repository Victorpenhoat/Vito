"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addReservation } from "../data/actions";
import { RESERVATION_TYPES } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { DateField } from "@/features/shared/ui/DateField";
import { Input, fieldClass } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";

export function ReservationForm({ voyageId }: { voyageId: string }) {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(addReservation, undefined);
  return (
    <form action={action} data-testid="reservation-form" className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="voyageId" value={voyageId} />
      <Select name="type" aria-label={t("type")} defaultValue="hotel">
        {RESERVATION_TYPES.map((ty) => <option key={ty} value={ty}>{t(`types.${ty}`)}</option>)}
      </Select>
      <Input name="fournisseur" placeholder={t("fournisseur")} />
      <Input name="reference" placeholder={t("reference")} />
      <div className="flex gap-2">
        <DateField name="dateDebut" aria-label={t("dateDebut")} />
        <DateField name="dateFin" aria-label={t("dateFin")} />
      </div>
      <Input name="conciergerieTel" placeholder={t("conciergerieTel")} />
      <Input name="conciergerieMail" type="email" placeholder={t("conciergerieMail")} />
      <Input name="lien" type="url" placeholder={t("lien")} />
      <textarea name="notes" placeholder={t("notes")} className={fieldClass} />
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("addReservation")}</Button>
    </form>
  );
}
