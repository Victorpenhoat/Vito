"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { repondreDemande } from "../data/actions";
import { CONCIERGERIE_STATUTS } from "../domain/schemas";

export function ReponseForm({ demandeId }: { demandeId: string }) {
  const t = useTranslations("conciergerie");
  const [state, action, pending] = useActionState(repondreDemande, undefined);
  return (
    <form action={action} data-testid="reponse-form" className="flex flex-col gap-2 border-t pt-2">
      <input type="hidden" name="demandeId" value={demandeId} />
      <select name="statut" aria-label={t("statut")} className="border p-2" defaultValue="confirmee">
        {CONCIERGERIE_STATUTS.map((s) => <option key={s} value={s}>{t(`statuts.${s}`)}</option>)}
      </select>
      <textarea name="reponse" placeholder={t("reponse")} className="border p-2" />
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("repondre")}</button>
    </form>
  );
}
