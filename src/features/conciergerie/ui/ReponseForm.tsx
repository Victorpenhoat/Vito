"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { repondreDemande } from "../data/actions";
import { CONCIERGERIE_STATUTS } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { fieldClass } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";

export function ReponseForm({ demandeId }: { demandeId: string }) {
  const t = useTranslations("conciergerie");
  const [state, action, pending] = useActionState(repondreDemande, undefined);
  return (
    <form action={action} data-testid="reponse-form" className="flex flex-col gap-2 border-t pt-2">
      <input type="hidden" name="demandeId" value={demandeId} />
      <Select name="statut" aria-label={t("statut")} defaultValue="confirmee">
        {CONCIERGERIE_STATUTS.map((s) => <option key={s} value={s}>{t(`statuts.${s}`)}</option>)}
      </Select>
      <textarea name="reponse" placeholder={t("reponse")} className={fieldClass} />
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("repondre")}</Button>
    </form>
  );
}
