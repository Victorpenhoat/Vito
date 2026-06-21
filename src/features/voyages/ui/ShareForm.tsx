"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { shareVoyage } from "../data/actions";

export function ShareForm({ voyageId }: { voyageId: string }) {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(shareVoyage, undefined);
  return (
    <form action={action} data-testid="share-form" className="flex gap-2 items-center">
      <input type="hidden" name="voyageId" value={voyageId} />
      <input name="email" type="email" required placeholder={t("partagerEmail")} className="border p-2 flex-1" />
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("partager")}</button>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
