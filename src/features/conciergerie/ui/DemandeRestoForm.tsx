"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { creerDemandeResto } from "../data/actions";
import { OCCASIONS } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { Checkbox } from "@/features/shared/ui/Checkbox";
import { DateField } from "@/features/shared/ui/DateField";
import { Input, fieldClass } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";

export function DemandeRestoForm({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("conciergerie");
  const [state, action, pending] = useActionState(creerDemandeResto, undefined);
  return (
    <form action={action} data-testid="demande-resto-form" className="flex flex-col gap-2 max-w-md border-t pt-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <div className="flex gap-2">
        <DateField name="dateResa" required aria-label={t("date")} />
        <Input name="heureResa" type="time" required aria-label={t("heure")} />
      </div>
      <Input name="nombreConvives" type="number" min={1} required placeholder={t("convives")} />
      <Select name="occasion" aria-label={t("occasion")} defaultValue="amis">
        {OCCASIONS.map((o) => <option key={o} value={o}>{t(`occasions.${o}`)}</option>)}
      </Select>
      <Checkbox name="avecEnfants" label={t("avecEnfants")} />
      <Input name="nbEnfants" type="number" min={0} placeholder={t("nbEnfants")} />
      <Checkbox name="chaiseHaute" label={t("chaiseHaute")} />
      <textarea name="commentaire" placeholder={t("commentaire")} className={fieldClass} />
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("envoyer")}</Button>
    </form>
  );
}
