"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addDegustation } from "../data/actions";
import { VIN_COULEURS } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";

const inputCls = "rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent";

export function DegustationForm({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("vins");
  const [state, action, pending] = useActionState(addDegustation, undefined);
  return (
    <form action={action} data-testid="degustation-form" className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input name="nom" required placeholder={t("nom")} className={inputCls} />
      <div className="flex gap-2">
        <input name="domaine" placeholder={t("domaine")} className={`${inputCls} flex-1`} />
        <input name="millesime" type="number" min={1900} max={2100} placeholder={t("millesime")} className={`${inputCls} w-28`} />
      </div>
      <div className="flex gap-2">
        <input name="region" placeholder={t("region")} className={`${inputCls} flex-1`} />
        <select name="couleur" className={inputCls} defaultValue="">
          <option value="">{t("couleur")}</option>
          {VIN_COULEURS.map((c) => (
            <option key={c} value={c}>{t(`couleurs.${c}`)}</option>
          ))}
        </select>
      </div>
      <input name="cepages" placeholder={t("cepages")} className={inputCls} />
      <div className="flex gap-2">
        <input name="note" type="number" min={1} max={5} placeholder={t("note")} className={`${inputCls} w-24`} />
        <input name="prixPaye" type="number" min={0} step="0.01" placeholder={t("prix")} className={`${inputCls} w-32`} />
        <input name="degusteLe" type="date" aria-label={t("date")} title={t("date")} className={inputCls} />
      </div>
      <textarea name="commentaire" placeholder={t("commentaire")} className={inputCls} />
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("add")}</Button>
    </form>
  );
}
