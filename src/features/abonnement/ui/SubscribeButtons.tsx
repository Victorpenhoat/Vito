"use client";
import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { subscribe } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function SubscribeButtons() {
  const t = useTranslations("abonnement");
  const [state, action, pending] = useActionState(subscribe, undefined);
  useEffect(() => {
    if (state && "redirect" in state && state.redirect) window.location.href = state.redirect;
  }, [state]);
  return (
    <form action={action} data-testid="subscribe-form" className="flex flex-col gap-2 max-w-sm">
      <p className="text-sm text-muted">{t("upsell")}</p>
      <div className="flex gap-2">
        <Button type="submit" name="period" value="monthly" pending={pending} data-testid="subscribe-monthly" className="flex-1">{t("monthly")}</Button>
        <Button type="submit" name="period" value="yearly" pending={pending} data-testid="subscribe-yearly" className="flex-1">{t("yearly")}</Button>
      </div>
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
    </form>
  );
}
