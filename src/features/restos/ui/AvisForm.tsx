"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addAvis } from "../data/actions";

export function AvisForm({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("restos");
  const [state, action, pending] = useActionState(addAvis, undefined);
  return (
    <form action={action} data-testid="avis-form" className="flex flex-col gap-2">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input name="note" type="number" min={1} max={5} placeholder={t("notePlaceholder")} className="border p-2" />
      <textarea name="commentaire" placeholder={t("commentairePlaceholder")} className="border p-2" />
      <input name="visiteLe" type="date" className="border p-2" />
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("addAvis")}</button>
    </form>
  );
}
