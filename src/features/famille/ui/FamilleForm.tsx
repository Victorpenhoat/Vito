"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { creerFamille } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function FamilleForm() {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(creerFamille, undefined);
  return (
    <form action={action} data-testid="famille-form" className="flex flex-col gap-2 max-w-md">
      <p className="text-muted">{t("pasDeFamille")}</p>
      <input name="nom" required placeholder={t("nom")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("creer")}</Button>
    </form>
  );
}
