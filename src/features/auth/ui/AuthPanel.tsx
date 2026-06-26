"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AuthForm } from "./AuthForm";

type Action = (prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>;

export function AuthPanel({ signIn, signUp }: { signIn: Action; signUp: Action }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const tab = (active: boolean) =>
    `flex-1 rounded-control py-2 text-sm font-semibold ${active ? "bg-surface text-ink shadow-sm" : "text-muted"}`;
  return (
    <div data-testid="auth-panel" className="w-full">
      <div className="mb-4 flex gap-1 rounded-control bg-canvas p-1" role="tablist">
        <button
          type="button"
          role="tab"
          data-testid="tab-login"
          aria-selected={mode === "login"}
          onClick={() => setMode("login")}
          className={tab(mode === "login")}
        >
          {t("login")}
        </button>
        <button
          type="button"
          role="tab"
          data-testid="tab-signup"
          aria-selected={mode === "signup"}
          onClick={() => setMode("signup")}
          className={tab(mode === "signup")}
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
