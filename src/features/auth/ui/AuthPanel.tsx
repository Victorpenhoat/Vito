"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConnexionPanel } from "./ConnexionPanel";
import { Link } from "@/lib/i18n/routing";

type Action = (prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>;

type ActionLien = (prev: unknown, fd: FormData) => Promise<{ error?: string; envoye?: true; email?: string }>;

export function AuthPanel({ signIn, envoyerLienMagique }: {
  signIn: Action; envoyerLienMagique: ActionLien;
}) {
  const t = useTranslations("auth");
  const ti = useTranslations("invitations");
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
      {mode === "login" ? (
        <ConnexionPanel signIn={signIn} envoyerLienMagique={envoyerLienMagique} />
      ) : (
        // Vito se rejoint sur invitation (décision PO) : pas de formulaire ici.
        <div data-testid="inscription-sur-invitation" className="flex flex-col gap-3 text-left">
          <p className="text-sm text-muted">{ti("surInvitation.texte")}</p>
          <Link href="/inscription" className="rounded-control bg-accent px-4 py-2.5 text-center font-semibold text-white">
            {ti("surInvitation.titre")}
          </Link>
        </div>
      )}
    </div>
  );
}
