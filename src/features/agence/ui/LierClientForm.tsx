"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { lierClient } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function LierClientForm() {
  const t = useTranslations("agence");
  const [state, action, pending] = useActionState(lierClient, undefined);
  return (
    <form action={action} data-testid="lier-client-form" className="flex gap-2 items-center">
      <input name="email" type="email" required placeholder={t("clientEmail")} className="rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent flex-1" />
      <Button type="submit" pending={pending}>{t("lier")}</Button>
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
    </form>
  );
}
