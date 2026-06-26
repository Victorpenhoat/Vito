"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { inviterMembre } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function InviteForm() {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(inviterMembre, undefined);
  return (
    <form action={action} data-testid="invite-form" className="flex gap-2 items-center">
      <input name="email" type="email" required placeholder={t("inviteEmail")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent flex-1" />
      <Button type="submit" pending={pending}>{t("inviter")}</Button>
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
    </form>
  );
}
