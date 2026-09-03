"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Fingerprint } from "lucide-react";
import { useRouter } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { cleBiometrie, detecterPlateforme } from "../domain/appareil";

// Connexion par passkey (design Onboarding écran 9) : mise en avant quand
// l'appareil sait en présenter une. La cérémonie WebAuthn est prise en charge
// par le SDK — aucune clé ne transite par nos serveurs.
export function BoutonPasskey({ onEchec }: { onEchec?: (message: string) => void }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [disponible, setDisponible] = useState(false);
  const [libelle, setLibelle] = useState("biometrie.passkey");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    // Le bouton n'apparaît que si le navigateur sait gérer une passkey de
    // plateforme : sinon il ne ferait qu'échouer.
    let vivant = true;
    (async () => {
      const cle = cleBiometrie(detecterPlateforme(navigator.userAgent));
      try {
        const ok =
          typeof PublicKeyCredential !== "undefined" &&
          (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
        if (!vivant) return;
        setDisponible(ok);
        setLibelle(cle);
      } catch {
        /* navigateur sans WebAuthn : le bouton reste masqué */
      }
    })();
    return () => { vivant = false; };
  }, []);

  if (!disponible) return null;

  async function connecter() {
    setEnCours(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) {
        // Message neutre : ne dit jamais si un compte ou une passkey existe.
        onEchec?.(t("passkeyEchec"));
        return;
      }
      router.replace("/accueil");
      router.refresh();
    } catch {
      onEchec?.(t("passkeyEchec"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <button type="button" data-testid="connexion-passkey" disabled={enCours}
      onClick={() => void connecter()}
      className="inline-flex items-center justify-center gap-2 rounded-control bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60">
      <Fingerprint size={16} aria-hidden />
      {t("continuerAvec", { moyen: t(libelle) })}
    </button>
  );
}
