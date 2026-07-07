"use client";
import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { manageSubscription } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function ManageButton() {
  const t = useTranslations("abonnement");
  const [state, action, pending] = useActionState(manageSubscription, undefined);
  useEffect(() => {
    if (state && "redirect" in state && state.redirect) window.location.href = state.redirect;
  }, [state]);
  return (
    <form action={action} data-testid="manage-form">
      <Button type="submit" variant="ghost" pending={pending} data-testid="manage-sub">{t("manage")}</Button>
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
    </form>
  );
}
