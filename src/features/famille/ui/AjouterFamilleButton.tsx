"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ajouterRestoFiche } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function AjouterFamilleButton({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(ajouterRestoFiche, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <Button type="submit" pending={pending} variant="ghost" data-testid="ajouter-famille">{t("ajouterFamille")}</Button>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
