"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { addReservation } from "../data/actions";
import { RESERVATION_TYPES } from "../domain/schemas";
import { estHebergement } from "../domain/reservationHebergement";
import { HebergementPicker } from "./HebergementPicker";
import { Button } from "@/features/shared/ui/Button";
import { DateField } from "@/features/shared/ui/DateField";
import { Input, fieldClass } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";

export function ReservationForm({ voyageId }: { voyageId: string }) {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(addReservation, undefined);
  // Le type pilote l'affichage : seul un hébergement se rattache au carnet
  // Hôtels — un vol ou une voiture n'y a rien à faire (lot H6).
  const [type, setType] = useState<string>("hotel");
  const [hebergement, setHebergement] = useState<{ placeId: string; nom: string } | null>(null);
  const [fournisseur, setFournisseur] = useState("");
  return (
    <form action={action} data-testid="reservation-form" className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="voyageId" value={voyageId} />
      <Select name="type" aria-label={t("type")} value={type}
        onChange={(e) => { setType(e.target.value); if (!estHebergement(e.target.value)) setHebergement(null); }}>
        {RESERVATION_TYPES.map((ty) => <option key={ty} value={ty}>{t(`types.${ty}`)}</option>)}
      </Select>
      {estHebergement(type) && (
        <HebergementPicker choisi={hebergement}
          onChoisir={(v) => { setHebergement(v); if (v) setFournisseur(v.nom); }} />
      )}
      <Input name="fournisseur" placeholder={t("fournisseur")}
        value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} />
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
