"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { inviterMembre } from "../data/actions";

export function InviteForm() {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(inviterMembre, undefined);
  return (
    <form action={action} data-testid="invite-form" className="flex gap-2 items-center">
      <input name="email" type="email" required placeholder={t("inviteEmail")} className="border p-2 flex-1" />
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("inviter")}</button>
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
    </form>
  );
}
