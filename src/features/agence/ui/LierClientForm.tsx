"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { lierClient } from "../data/actions";

export function LierClientForm() {
  const t = useTranslations("agence");
  const [state, action, pending] = useActionState(lierClient, undefined);
  return (
    <form action={action} data-testid="lier-client-form" className="flex gap-2 items-center">
      <input name="email" type="email" required placeholder={t("clientEmail")} className="border p-2 flex-1" />
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("lier")}</button>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
