"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { cancelSubscription } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function CancelButton() {
  const t = useTranslations("abonnement");
  const [state, action, pending] = useActionState(cancelSubscription, undefined);
  return (
    <form action={action} data-testid="cancel-form">
      <Button type="submit" variant="ghost" pending={pending} data-testid="cancel-sub">{t("cancel")}</Button>
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
    </form>
  );
}
