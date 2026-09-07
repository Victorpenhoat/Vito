"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changerStatutActivite } from "../data/actions";
import { STATUTS_ACTIVITE } from "../domain/activite";

const TEINTE: Record<string, string> = {
  en_cours: "border-kpi-green/30 bg-kpi-green-bg text-kpi-green",
  en_pause: "border-current/20 bg-kpi-amber-bg text-kpi-amber",
  terminee: "border-line bg-surface-hover text-muted",
};

// « En cours ▾ » du design : le statut se change là où on le lit, sans passer
// par un écran d'édition. Un <select> plutôt qu'un menu maison — il est natif,
// accessible au clavier, et le système l'affiche comme l'utilisateur l'attend.
export function StatutActivite({ activiteId, statut }: { activiteId: string; statut: string }) {
  const t = useTranslations("activites");
  const [state, action, pending] = useActionState(changerStatutActivite, undefined);
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="activiteId" value={activiteId} />
      <select
        name="statut"
        defaultValue={statut}
        data-testid="fiche-statut"
        aria-label={t("filtres.statut")}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${TEINTE[statut] ?? TEINTE.terminee}`}
      >
        {STATUTS_ACTIVITE.map((s) => (
          <option key={s} value={s}>{t(`statuts.${s}`)}</option>
        ))}
      </select>
      {state && "error" in state && state.error && (
        <span role="alert" className="text-[11.5px] text-danger">{state.error}</span>
      )}
    </form>
  );
}
