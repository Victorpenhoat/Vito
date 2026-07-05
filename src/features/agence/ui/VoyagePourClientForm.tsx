"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { creerVoyagePourClient } from "../data/actions";
import { VOYAGE_STATUTS } from "@/features/voyages/domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";

export function VoyagePourClientForm({ clientId }: { clientId: string }) {
  const t = useTranslations("agence");
  const [state, action, pending] = useActionState(creerVoyagePourClient, undefined);
  return (
    <form action={action} data-testid="voyage-client-form" className="flex flex-col gap-2 border-t pt-2">
      <input type="hidden" name="clientId" value={clientId} />
      <Input name="titre" required placeholder={t("titre")} />
      <Input name="destination" placeholder={t("destination")} />
      <div className="flex gap-2">
        <Input name="dateDebut" type="date" aria-label={t("dateDebut")} className="flex-1" />
        <Input name="dateFin" type="date" aria-label={t("dateFin")} className="flex-1" />
      </div>
      <Select name="statut" aria-label={t("statut")} defaultValue="planifie">
        {VOYAGE_STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("envoyer")}</Button>
    </form>
  );
}
