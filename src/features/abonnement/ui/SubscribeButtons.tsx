"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { subscribe } from "../data/actions";

export function SubscribeButtons() {
  const t = useTranslations("abonnement");
  const [state, action, pending] = useActionState(subscribe, undefined);
  return (
    <form action={action} data-testid="subscribe-form" className="flex flex-col gap-2 max-w-sm">
      <p className="text-sm text-gray-600">{t("upsell")}</p>
      <div className="flex gap-2">
        <button type="submit" name="period" value="monthly" disabled={pending} data-testid="subscribe-monthly" className="bg-black text-white p-2 flex-1">{t("monthly")}</button>
        <button type="submit" name="period" value="yearly" disabled={pending} data-testid="subscribe-yearly" className="bg-black text-white p-2 flex-1">{t("yearly")}</button>
      </div>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
