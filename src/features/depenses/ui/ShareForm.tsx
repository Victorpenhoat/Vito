"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { shareGroupe } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function ShareForm({ groupeId }: { groupeId: string }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(shareGroupe, undefined);
  return (
    <form action={action} data-testid="share-form" className="flex gap-2 items-center mt-3">
      <input type="hidden" name="groupeId" value={groupeId} />
      <input name="email" type="email" required placeholder={t("partagerEmail")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent flex-1" />
      <Button type="submit" pending={pending}>{t("partager")}</Button>
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
    </form>
  );
}
