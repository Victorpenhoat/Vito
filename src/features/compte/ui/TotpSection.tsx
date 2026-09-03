"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/features/shared/ui/Button";

type Etat = "inconnu" | "absent" | "en_cours" | "actif";

// Double authentification par application (design écran 14, optionnelle).
// Tout passe par le SDK : le secret n'est jamais stocké par l'application.
export function TotpSection() {
  const t = useTranslations("compte");
  const [etat, setEtat] = useState<Etat>("inconnu");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const verifie = data?.totp?.find((f) => f.status === "verified");
      if (verifie) { setFactorId(verifie.id); setEtat("actif"); return; }
      setEtat("absent");
    } catch {
      setEtat("absent");
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- état du facteur connu seulement côté client (appel au serveur d'auth)
  useEffect(() => { void charger(); }, [charger]);

  async function activer() {
    setPending(true); setErreur(null);
    try {
      const supabase = createClient();
      // Un facteur non vérifié peut traîner d'une tentative précédente : on le
      // retire pour ne pas accumuler des inscriptions mortes.
      const { data: existants } = await supabase.auth.mfa.listFactors();
      for (const f of existants?.totp ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error || !data) { setErreur(t("totp.echecActivation")); return; }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setEtat("en_cours");
    } catch {
      setErreur(t("totp.echecActivation"));
    } finally {
      setPending(false);
    }
  }

  async function confirmer() {
    if (!factorId) return;
    setPending(true); setErreur(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (error) { setErreur(t("totp.codeRefuse")); return; }
      setQr(null); setSecret(null); setCode("");
      setEtat("actif");
    } catch {
      setErreur(t("totp.codeRefuse"));
    } finally {
      setPending(false);
    }
  }

  async function desactiver() {
    if (!factorId) return;
    setPending(true); setErreur(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) { setErreur(t("totp.echecDesactivation")); return; }
      setFactorId(null); setEtat("absent");
    } catch {
      setErreur(t("totp.echecDesactivation"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div data-testid="totp-section" className="flex flex-col gap-3 rounded-[5px] border border-line bg-surface px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13.5px] text-ink">{t("totp.titre")}</div>
          <p className="mt-0.5 text-[11.5px] text-muted">{t("totp.explication")}</p>
        </div>
        {etat === "actif" && (
          <span data-testid="totp-actif" className="shrink-0 rounded-full border border-current/20 bg-kpi-green-bg px-2 py-0.5 text-[10px] font-semibold text-kpi-green">
            {t("totp.active")}
          </span>
        )}
      </div>

      {etat === "en_cours" && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[12px] text-muted">{t("totp.scanner")}</p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- QR fourni en data-URI par le SDK
            <img src={qr} alt={t("totp.titre")} data-testid="totp-qr" className="h-40 w-40 self-start rounded-[5px] bg-white p-2" />
          )}
          {secret && (
            <p className="text-[11px] text-faint">
              {t("totp.secret")} <code data-testid="totp-secret" className="select-all font-mono">{secret}</code>
            </p>
          )}
          <label className="flex flex-col gap-1 text-[11px] text-muted">
            {t("totp.code")}
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value)} data-testid="totp-code"
              className="w-32 rounded-control border border-line bg-surface px-3 py-2 text-sm tracking-[0.3em] text-ink outline-none focus:outline-2 focus:outline-accent" />
          </label>
          <Button type="button" onClick={() => void confirmer()} pending={pending}
            data-testid="totp-confirmer" className="self-start py-2 text-xs">
            <ShieldCheck size={13} aria-hidden /> {t("totp.confirmer")}
          </Button>
        </div>
      )}

      {erreur && <p role="alert" className="text-sm text-danger">{erreur}</p>}

      {etat === "absent" && (
        <Button type="button" onClick={() => void activer()} pending={pending}
          data-testid="totp-activer" className="self-start py-2 text-xs">
          <Smartphone size={13} aria-hidden /> {t("totp.activer")}
        </Button>
      )}
      {etat === "actif" && (
        <button type="button" onClick={() => void desactiver()} disabled={pending}
          data-testid="totp-desactiver"
          className="self-start text-[12px] text-muted hover:text-danger disabled:opacity-60">
          {t("totp.desactiver")}
        </button>
      )}
    </div>
  );
}
