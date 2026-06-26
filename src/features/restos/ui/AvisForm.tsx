"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addAvis } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function AvisForm({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("restos");
  const [state, action, pending] = useActionState(addAvis, undefined);
  return (
    <form action={action} data-testid="avis-form" className="flex flex-col gap-2">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input name="note" type="number" min={1} max={5} placeholder={t("notePlaceholder")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <textarea name="commentaire" placeholder={t("commentairePlaceholder")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <input name="visiteLe" type="date" className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" variant="primary" pending={pending}>{t("addAvis")}</Button>
    </form>
  );
}
