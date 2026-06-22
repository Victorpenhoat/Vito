"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AuthForm } from "./AuthForm";

type Action = (prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>;

export function AuthPanel({ signIn, signUp }: { signIn: Action; signUp: Action }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const tabClass = (active: boolean) =>
    `flex-1 p-2 border-b-2 ${active ? "border-black font-semibold" : "border-transparent text-zinc-500"}`;
  return (
    <div data-testid="auth-panel" className="w-full">
      <div className="mb-4 flex gap-2" role="tablist">
        <button
          type="button"
          data-testid="tab-login"
          aria-selected={mode === "login"}
          onClick={() => setMode("login")}
          className={tabClass(mode === "login")}
        >
          {t("login")}
        </button>
        <button
          type="button"
          data-testid="tab-signup"
          aria-selected={mode === "signup"}
          onClick={() => setMode("signup")}
          className={tabClass(mode === "signup")}
        >
          {t("signupTab")}
        </button>
      </div>
      <AuthForm
        key={mode}
        action={mode === "login" ? signIn : signUp}
        submitLabelKey={mode === "login" ? "login" : "signup"}
      />
    </div>
  );
}
