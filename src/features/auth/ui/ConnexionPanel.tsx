"use client";
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, KeyRound } from "lucide-react";
import { useRouter } from "@/lib/i18n/routing";

type ActionMdp = (prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>;
type ActionLien = (prev: unknown, fd: FormData) => Promise<{ error?: string; envoye?: true; email?: string }>;

// Connexion (design Onboarding_Compte écran 9) : le lien par email est la voie
// principale, le mot de passe reste un repli discret. Le bouton passkey arrivera
// avec le lot O-E — il n'est pas affiché tant qu'il n'a pas de mécanique
// derrière, plutôt qu'un bouton qui ne fait rien.
export function ConnexionPanel({ signIn, envoyerLienMagique }: {
  signIn: ActionMdp; envoyerLienMagique: ActionLien;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [avecMdp, setAvecMdp] = useState(false);
  const [lienState, envoyerLien, lienPending] = useActionState(envoyerLienMagique, undefined);
  const [mdpState, connexionMdp, mdpPending] = useActionState(signIn, undefined);

  const enAttente = Boolean(lienState?.envoye);

  const inputClass =
    "rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-transparent focus:outline-2 focus:outline-accent";

  if (enAttente) {
    return (
      <AttenteLien
        email={lienState?.email ?? email}
        onCorriger={() => { setAvecMdp(false); router.refresh(); }}
        renvoyer={envoyerLien}
        pending={lienPending}
      />
    );
  }

  return (
    <div data-testid="connexion-panel" className="flex w-full flex-col gap-3 text-left">
      <form action={envoyerLien} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("email")}
          <input name="email" type="email" required autoComplete="email" data-testid="champ-email"
            value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
        {lienState?.error && <p role="alert" className="text-sm text-danger">{lienState.error}</p>}
        <button type="submit" disabled={lienPending} data-testid="envoyer-lien"
          className="inline-flex items-center justify-center gap-2 rounded-control bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60">
          <Mail size={16} aria-hidden />
          {t("recevoirLien")}
        </button>
      </form>

      {!avecMdp ? (
        <button type="button" data-testid="utiliser-mot-de-passe" onClick={() => setAvecMdp(true)}
          className="inline-flex items-center justify-center gap-1.5 self-center text-[12.5px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
          <KeyRound size={13} aria-hidden />
          {t("utiliserMotDePasse")}
        </button>
      ) : (
        <form action={connexionMdp} className="flex flex-col gap-3 border-t border-line pt-3">
          <input type="hidden" name="email" value={email} />
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("password")}
            <input name="password" type="password" required autoComplete="current-password"
              data-testid="champ-mot-de-passe" className={inputClass} />
          </label>
          {mdpState?.error && <p role="alert" className="text-sm text-danger">{mdpState.error}</p>}
          <button type="submit" disabled={mdpPending}
            className="rounded-control border border-line bg-surface px-4 py-2.5 font-semibold text-ink disabled:opacity-60">
            {t("login")}
          </button>
        </form>
      )}
    </div>
  );
}

// Écran « Ouvrez le lien reçu » (design écran 3) : renvoi temporisé, correction
// de l'adresse, et mise à jour automatique quand le lien est ouvert ailleurs.
function AttenteLien({ email, onCorriger, renvoyer, pending }: {
  email: string; onCorriger: () => void; renvoyer: (fd: FormData) => void; pending: boolean;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [restant, setRestant] = useState(60);

  useEffect(() => {
    if (restant <= 0) return;
    const id = setTimeout(() => setRestant((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [restant]);

  // Le lien peut être ouvert sur un autre appareil : on sonde la session et on
  // entre dans l'app dès qu'elle existe.
  useEffect(() => {
    let vivant = true;
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/auth/etat", { cache: "no-store" });
        const { connecte } = (await r.json()) as { connecte: boolean };
        if (connecte && vivant) { clearInterval(id); router.replace("/accueil"); }
      } catch { /* hors ligne : on retentera au prochain tour */ }
    }, 3000);
    return () => { vivant = false; clearInterval(id); };
  }, [router]);

  const mmss = `0:${String(restant).padStart(2, "0")}`;

  return (
    <div data-testid="attente-lien" className="flex w-full flex-col gap-3 text-left">
      <h2 className="font-serif text-xl text-ink">{t("ouvrezLeLien")}</h2>
      <p className="text-sm text-muted">
        {t("lienEnvoye", { email })} {t("lienValidite")}
      </p>
      <p className="inline-flex items-center gap-2 text-[12.5px] text-faint">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
        {t("enAttenteOuverture")}
      </p>
      <form action={renvoyer}>
        <input type="hidden" name="email" value={email} />
        <button type="submit" disabled={pending || restant > 0} data-testid="renvoyer-lien"
          className="text-[12.5px] font-semibold text-accent disabled:text-faint">
          {restant > 0 ? t("renvoyerDans", { temps: mmss }) : t("renvoyer")}
        </button>
      </form>
      <button type="button" data-testid="corriger-adresse" onClick={onCorriger}
        className="self-start text-[12.5px] text-muted hover:text-ink">
        {t("corrigerAdresse")}
      </button>
    </div>
  );
}
