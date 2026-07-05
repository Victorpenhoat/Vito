"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { shareGroupe } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";

export function ShareForm({ groupeId }: { groupeId: string }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(shareGroupe, undefined);
  return (
    <form action={action} data-testid="share-form" className="flex gap-2 items-center mt-3">
      <input type="hidden" name="groupeId" value={groupeId} />
      <Input name="email" type="email" required placeholder={t("partagerEmail")} className="flex-1" />
      <Button type="submit" pending={pending}>{t("partager")}</Button>
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
    </form>
  );
}
