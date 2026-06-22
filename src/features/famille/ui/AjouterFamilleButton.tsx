"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ajouterRestoFiche } from "../data/actions";

export function AjouterFamilleButton({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(ajouterRestoFiche, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <button type="submit" disabled={pending} data-testid="ajouter-famille" className="underline">{t("ajouterFamille")}</button>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
