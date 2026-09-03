"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Fingerprint, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cleBiometrie, detecterPlateforme } from "@/features/auth/domain/appareil";
import { Button } from "@/features/shared/ui/Button";

/** Nom lisible de l'appareil courant, pour distinguer les passkeys entre elles. */
function nomAppareil(): string {
  const plateforme = detecterPlateforme(navigator.userAgent);
  const libelles: Record<string, string> = {
    ios: "iPhone", macos: "Mac", windows: "Windows", android: "Android", autre: "Appareil",
  };
  return libelles[plateforme] ?? "Appareil";
}

type Passkey = { id: string; friendly_name?: string; created_at: string; last_used_at?: string };

// Réglages > Sécurité : passkeys enregistrées (design Onboarding écran 14).
// Ajout et révocation passent par le SDK ; la liste vient du serveur d'auth.
export function PasskeysSection() {
  const t = useTranslations("compte");
  const ta = useTranslations("auth");
  const format = useFormatter();
  const [liste, setListe] = useState<Passkey[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [libelle, setLibelle] = useState("biometrie.passkey");

  const charger = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      setListe(data ?? []);
    } catch {
      setListe([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- libellé dépendant de l'appareil, connu côté client
    setLibelle(cleBiometrie(detecterPlateforme(navigator.userAgent)));
    void charger();
  }, [charger]);

  async function ajouter() {
    setEnCours(true);
    setErreur(null);
    try {
      const supabase = createClient();
      // Le SDK ne prend pas de nom à l'inscription : on renomme juste après,
      // pour que la liste reste lisible (« iPhone 15 · Face ID »).
      const { data, error } = await supabase.auth.registerPasskey();
      if (error) { setErreur(t("passkeys.echecAjout")); return; }
      if (data?.id) {
        await supabase.auth.passkey.update({ passkeyId: data.id, friendlyName: nomAppareil() });
      }
      await charger();
    } catch {
      setErreur(t("passkeys.echecAjout"));
    } finally {
      setEnCours(false);
    }
  }

  async function revoquer(id: string) {
    setEnCours(true);
    setErreur(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
      if (error) { setErreur(t("passkeys.echecRevocation")); return; }
      await charger();
    } catch {
      setErreur(t("passkeys.echecRevocation"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div data-testid="passkeys-section" className="flex flex-col gap-3 rounded-[5px] border border-line bg-surface px-3.5 py-3">
      <div>
        <div className="text-[13.5px] text-ink">{t("passkeys.titre")}</div>
        <p className="mt-0.5 text-[11.5px] text-muted">{t("passkeys.explication")}</p>
      </div>

      {liste === null ? (
        <p className="text-[12px] text-faint">{t("passkeys.chargement")}</p>
      ) : liste.length === 0 ? (
        <p data-testid="passkeys-vide" className="text-[12px] text-muted">{t("passkeys.aucune")}</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {liste.map((p) => (
            <li key={p.id} data-testid="passkey-row" className="flex items-center gap-3 py-2">
              <Fingerprint size={15} className="shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">
                  {p.friendly_name?.trim() || t("passkeys.sansNom")}
                </span>
                {p.created_at && (
                  <span className="block text-[11px] text-faint">
                    {t("passkeys.ajouteeLe", { date: format.dateTime(new Date(p.created_at), { dateStyle: "medium" }) })}
                  </span>
                )}
              </span>
              <button type="button" data-testid="passkey-revoquer" disabled={enCours}
                onClick={() => void revoquer(p.id)}
                aria-label={t("passkeys.revoquer")}
                className="shrink-0 rounded-full border border-line bg-surface-hover p-1.5 text-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {erreur && <p role="alert" className="text-sm text-danger">{erreur}</p>}
      <Button type="button" onClick={() => void ajouter()} pending={enCours}
        data-testid="passkey-ajouter" className="self-start py-2 text-xs">
        <Plus size={13} aria-hidden /> {ta("continuerAvec", { moyen: ta(libelle) })}
      </Button>
    </div>
  );
}
