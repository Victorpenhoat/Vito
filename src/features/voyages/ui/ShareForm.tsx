"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { shareVoyage } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function ShareForm({ voyageId }: { voyageId: string }) {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(shareVoyage, undefined);
  return (
    <form action={action} data-testid="share-form" className="flex gap-2 items-center">
      <input type="hidden" name="voyageId" value={voyageId} />
      <input name="email" type="email" required placeholder={t("partagerEmail")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent flex-1" />
      <Button type="submit" pending={pending}>{t("partager")}</Button>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
