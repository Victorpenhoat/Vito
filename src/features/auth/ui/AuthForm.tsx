"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

type Action = (prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>;

export function AuthForm({ action, submitLabelKey }: { action: Action; submitLabelKey: string }) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(action, undefined);
  const inputClass =
    "rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-transparent focus:outline-2 focus:outline-accent";
  return (
    <form action={formAction} className="flex flex-col gap-3 text-left">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("email")}
        <input name="email" type="email" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("password")}
        <input name="password" type="password" required className={inputClass} />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-xl bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {t(submitLabelKey)}
      </button>
    </form>
  );
}
