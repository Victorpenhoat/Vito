"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addDegustation } from "../data/actions";
import { VIN_COULEURS } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { DateField } from "@/features/shared/ui/DateField";
import { Input, fieldClass } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";


export function DegustationForm({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("vins");
  const [state, action, pending] = useActionState(addDegustation, undefined);
  return (
    <form action={action} data-testid="degustation-form" className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <Input name="nom" required placeholder={t("nom")} />
      <div className="flex gap-2">
        <Input name="domaine" placeholder={t("domaine")} className="flex-1" />
        <Input name="millesime" type="number" min={1900} max={2100} placeholder={t("millesime")} className="w-28" />
      </div>
      <div className="flex gap-2">
        <Input name="region" placeholder={t("region")} className="flex-1" />
        <Select name="couleur" defaultValue="">
          <option value="">{t("couleur")}</option>
          {VIN_COULEURS.map((c) => (
            <option key={c} value={c}>{t(`couleurs.${c}`)}</option>
          ))}
        </Select>
      </div>
      <Input name="cepages" placeholder={t("cepages")} />
      {/* flex-wrap : en mobile la date passe à la ligne au lieu d'écraser les champs
          (largeurs calées sur les placeholders « Note (1-5) » / « Prix payé (€) ») */}
      <div className="flex flex-wrap gap-2">
        <Input name="note" type="number" min={1} max={5} placeholder={t("note")} className="w-32" />
        <Input name="prixPaye" type="number" min={0} step="0.01" placeholder={t("prix")} className="w-36" />
        <DateField name="degusteLe" aria-label={t("date")} title={t("date")} />
      </div>
      <textarea name="commentaire" placeholder={t("commentaire")} className={fieldClass} />
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("add")}</Button>
    </form>
  );
}
