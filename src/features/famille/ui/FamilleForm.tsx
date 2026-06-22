"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { creerFamille } from "../data/actions";

export function FamilleForm() {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(creerFamille, undefined);
  return (
    <form action={action} data-testid="famille-form" className="flex flex-col gap-2 max-w-md">
      <p>{t("pasDeFamille")}</p>
      <input name="nom" required placeholder={t("nom")} className="border p-2" />
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("creer")}</button>
    </form>
  );
}
