"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createVoyage } from "../data/actions";
import { VOYAGE_STATUTS } from "../domain/schemas";

export function VoyageForm() {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(createVoyage, undefined);
  return (
    <form action={action} data-testid="voyage-form" className="flex flex-col gap-2 max-w-md">
      <input name="titre" required placeholder={t("titre")} className="border p-2" />
      <input name="destination" placeholder={t("destination")} className="border p-2" />
      <div className="flex gap-2">
        <input name="dateDebut" type="date" aria-label={t("dateDebut")} className="border p-2" />
        <input name="dateFin" type="date" aria-label={t("dateFin")} className="border p-2" />
      </div>
      <select name="statut" aria-label={t("statut")} className="border p-2" defaultValue="planifie">
        {VOYAGE_STATUTS.map((s) => <option key={s} value={s}>{t(`statuts.${s}`)}</option>)}
      </select>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("create")}</button>
    </form>
  );
}
