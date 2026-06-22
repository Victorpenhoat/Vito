"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { cancelSubscription } from "../data/actions";

export function CancelButton() {
  const t = useTranslations("abonnement");
  const [state, action, pending] = useActionState(cancelSubscription, undefined);
  return (
    <form action={action} data-testid="cancel-form">
      <button type="submit" disabled={pending} data-testid="cancel-sub" className="underline">{t("cancel")}</button>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
