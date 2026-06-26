"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { creerVoyagePourClient } from "../data/actions";
import { VOYAGE_STATUTS } from "@/features/voyages/domain/schemas";
import { Button } from "@/features/shared/ui/Button";

export function VoyagePourClientForm({ clientId }: { clientId: string }) {
  const t = useTranslations("agence");
  const [state, action, pending] = useActionState(creerVoyagePourClient, undefined);
  return (
    <form action={action} data-testid="voyage-client-form" className="flex flex-col gap-2 border-t pt-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input name="titre" required placeholder={t("titre")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <input name="destination" placeholder={t("destination")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <div className="flex gap-2">
        <input name="dateDebut" type="date" aria-label={t("dateDebut")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent flex-1" />
        <input name="dateFin" type="date" aria-label={t("dateFin")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent flex-1" />
      </div>
      <select name="statut" aria-label={t("statut")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" defaultValue="planifie">
        {VOYAGE_STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("envoyer")}</Button>
    </form>
  );
}
