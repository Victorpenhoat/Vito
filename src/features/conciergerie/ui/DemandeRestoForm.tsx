"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { creerDemandeResto } from "../data/actions";
import { OCCASIONS } from "../domain/schemas";

export function DemandeRestoForm({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("conciergerie");
  const [state, action, pending] = useActionState(creerDemandeResto, undefined);
  return (
    <form action={action} data-testid="demande-resto-form" className="flex flex-col gap-2 max-w-md border-t pt-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <div className="flex gap-2">
        <input name="dateResa" type="date" required aria-label={t("date")} className="border p-2" />
        <input name="heureResa" type="time" required aria-label={t("heure")} className="border p-2" />
      </div>
      <input name="nombreConvives" type="number" min={1} required placeholder={t("convives")} className="border p-2" />
      <select name="occasion" aria-label={t("occasion")} className="border p-2" defaultValue="amis">
        {OCCASIONS.map((o) => <option key={o} value={o}>{t(`occasions.${o}`)}</option>)}
      </select>
      <label className="flex items-center gap-2"><input type="checkbox" name="avecEnfants" /> {t("avecEnfants")}</label>
      <input name="nbEnfants" type="number" min={0} placeholder={t("nbEnfants")} className="border p-2" />
      <label className="flex items-center gap-2"><input type="checkbox" name="chaiseHaute" /> {t("chaiseHaute")}</label>
      <textarea name="commentaire" placeholder={t("commentaire")} className="border p-2" />
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("envoyer")}</button>
    </form>
  );
}
