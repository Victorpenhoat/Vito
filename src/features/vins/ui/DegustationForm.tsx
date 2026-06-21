"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addDegustation } from "../data/actions";
import { VIN_COULEURS } from "../domain/schemas";

export function DegustationForm({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("vins");
  const [state, action, pending] = useActionState(addDegustation, undefined);
  return (
    <form action={action} data-testid="degustation-form" className="flex flex-col gap-2 border-t pt-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input name="nom" required placeholder={t("nom")} className="border p-2" />
      <div className="flex gap-2">
        <input name="domaine" placeholder={t("domaine")} className="border p-2 flex-1" />
        <input name="millesime" type="number" min={1900} max={2100} placeholder={t("millesime")} className="border p-2 w-28" />
      </div>
      <div className="flex gap-2">
        <input name="region" placeholder={t("region")} className="border p-2 flex-1" />
        <select name="couleur" className="border p-2" defaultValue="">
          <option value="">{t("couleur")}</option>
          {VIN_COULEURS.map((c) => (
            <option key={c} value={c}>{t(`couleurs.${c}`)}</option>
          ))}
        </select>
      </div>
      <input name="cepages" placeholder={t("cepages")} className="border p-2" />
      <div className="flex gap-2">
        <input name="note" type="number" min={1} max={5} placeholder={t("note")} className="border p-2 w-24" />
        <input name="prixPaye" type="number" min={0} step="0.01" placeholder={t("prix")} className="border p-2 w-32" />
        <input name="degusteLe" type="date" aria-label={t("date")} title={t("date")} className="border p-2" />
      </div>
      <textarea name="commentaire" placeholder={t("commentaire")} className="border p-2" />
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("add")}</button>
    </form>
  );
}
