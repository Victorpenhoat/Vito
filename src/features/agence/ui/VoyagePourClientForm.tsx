"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { creerVoyagePourClient } from "../data/actions";
import { VOYAGE_STATUTS } from "@/features/voyages/domain/schemas";

export function VoyagePourClientForm({ clientId }: { clientId: string }) {
  const t = useTranslations("agence");
  const [state, action, pending] = useActionState(creerVoyagePourClient, undefined);
  return (
    <form action={action} data-testid="voyage-client-form" className="flex flex-col gap-2 border-t pt-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input name="titre" required placeholder={t("titre")} className="border p-2" />
      <input name="destination" placeholder={t("destination")} className="border p-2" />
      <div className="flex gap-2">
        <input name="dateDebut" type="date" aria-label={t("dateDebut")} className="border p-2" />
        <input name="dateFin" type="date" aria-label={t("dateFin")} className="border p-2" />
      </div>
      <select name="statut" aria-label={t("statut")} className="border p-2" defaultValue="planifie">
        {VOYAGE_STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("envoyer")}</button>
    </form>
  );
}
