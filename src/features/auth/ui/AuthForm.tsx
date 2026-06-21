"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

type Action = (prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>;

export function AuthForm({ action, submitLabelKey }: { action: Action; submitLabelKey: string }) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-sm">
      <label>{t("email")}<input name="email" type="email" required className="border p-2 w-full" /></label>
      <label>{t("password")}<input name="password" type="password" required className="border p-2 w-full" /></label>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t(submitLabelKey)}</button>
    </form>
  );
}
