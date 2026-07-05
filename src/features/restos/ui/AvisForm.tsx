"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addAvis } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";
import { DateField } from "@/features/shared/ui/DateField";
import { Input, fieldClass } from "@/features/shared/ui/Input";

export function AvisForm({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("restos");
  const [state, action, pending] = useActionState(addAvis, undefined);
  return (
    <form action={action} data-testid="avis-form" className="flex flex-col gap-2">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <Input name="note" type="number" min={1} max={5} placeholder={t("notePlaceholder")} />
      <textarea name="commentaire" placeholder={t("commentairePlaceholder")} className={fieldClass} />
      <DateField name="visiteLe" aria-label={t("visiteLe")} />
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" variant="primary" pending={pending}>{t("addAvis")}</Button>
    </form>
  );
}
