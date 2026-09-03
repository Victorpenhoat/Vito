"use client";
import { useActionState, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, ShieldCheck } from "lucide-react";
import { deverrouillerApp } from "../data/actions";
import { doitVerrouiller } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";

const CLE_ACTIVITE = "vito.derniere-activite";
const PAS_ENREGISTREMENT_MS = 30_000;

// Verrouillage de l'application (design Onboarding écrans 6 et 10) : après
// inactivité, le carnet est masqué par un écran opaque — aucune donnée ne reste
// lisible par-dessus l'épaule, ni dans l'aperçu du sélecteur d'applications.
//
// ⚠ C'est une protection d'AFFICHAGE, côté navigateur. Les gardes réelles sont
// serveur : les numéros et les scans exigent une vérification à chaque
// révélation, indépendamment de ce verrou.
export function VerrouApp({ delaiMinutes }: { delaiMinutes: number }) {
  const t = useTranslations("compte");
  const [verrouille, setVerrouille] = useState(false);
  const [depuisMinutes, setDepuisMinutes] = useState(0);
  const [state, action, pending] = useActionState(deverrouillerApp, undefined);

  const lireActivite = () => {
    try {
      const brut = localStorage.getItem(CLE_ACTIVITE);
      return brut ? Number(brut) : Date.now();
    } catch {
      return Date.now();
    }
  };

  const marquerActivite = useCallback(() => {
    try { localStorage.setItem(CLE_ACTIVITE, String(Date.now())); } catch { /* stockage indisponible */ }
  }, []);

  const evaluer = useCallback(() => {
    const ecoule = Date.now() - lireActivite();
    if (doitVerrouiller(delaiMinutes, ecoule)) {
      setDepuisMinutes(Math.max(1, Math.round(ecoule / 60_000)));
      setVerrouille(true);
    }
  }, [delaiMinutes]);

  useEffect(() => {
    // À l'arrivée sur une page : l'app a-t-elle dormi plus longtemps que le délai ?
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture localStorage SSR-safe (même cas que CategoryDiscovery) : l'état du verrou ne peut être connu qu'au montage côté client
    evaluer();

    let dernierEnregistrement = 0;
    const surActivite = () => {
      const maintenant = Date.now();
      if (maintenant - dernierEnregistrement < PAS_ENREGISTREMENT_MS) return;
      dernierEnregistrement = maintenant;
      marquerActivite();
    };
    const surVisibilite = () => {
      // En quittant : on note l'heure de départ. En revenant : on mesure
      // l'absence écoulée depuis ce départ.
      if (document.visibilityState === "hidden") marquerActivite();
      else evaluer();
    };

    // On n'initialise le repère que s'il est absent : le rafraîchir à chaque
    // montage effacerait la trace d'une longue absence. L'activité réelle est
    // enregistrée par les interactions ci-dessous.
    try {
      if (!localStorage.getItem(CLE_ACTIVITE)) marquerActivite();
    } catch { /* stockage indisponible */ }
    window.addEventListener("pointerdown", surActivite, { passive: true });
    window.addEventListener("keydown", surActivite);
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      window.removeEventListener("pointerdown", surActivite);
      window.removeEventListener("keydown", surActivite);
      document.removeEventListener("visibilitychange", surVisibilite);
    };
  }, [evaluer, marquerActivite]);

  // Une vérification réussie rouvre le carnet et repart d'une activité fraîche.
  const [derniereReponse, setDerniereReponse] = useState(state);
  if (state !== derniereReponse) {
    setDerniereReponse(state);
    if (state && "ok" in state && state.ok) {
      marquerActivite();
      setVerrouille(false);
    }
  }

  // Marqueur discret : rend l'état du verrou observable (tests, diagnostic)
  // sans rien afficher à l'utilisateur.
  if (!verrouille) return <span data-testid="verrou-inactif" data-delai={delaiMinutes} hidden />;

  return (
    <div
      data-testid="verrou-app"
      role="dialog"
      aria-modal="true"
      // fond OPAQUE : rien du carnet ne transparaît, y compris dans l'aperçu
      // du sélecteur d'applications
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-app px-8"
    >
      <div className="text-center">
        <div className="text-[17px] font-bold tracking-[0.28em] text-ink">VITO</div>
        <div className="font-serif text-[13px] italic text-faint">{t("verrou.marqueSous")}</div>
      </div>
      <Lock size={26} className="text-muted" aria-hidden />
      <p className="text-center text-sm text-muted">{t("verrou.depuis", { minutes: depuisMinutes })}</p>

      <form action={action} className="flex w-full max-w-xs flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("verrou.motDePasse")}
          <input type="password" name="motDePasse" required autoComplete="current-password" autoFocus
            data-testid="verrou-mot-de-passe"
            className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
        </label>
        {state && "error" in state && state.error && (
          <p role="alert" className="text-sm text-danger">{t("verrou.echec")}</p>
        )}
        <Button type="submit" pending={pending} data-testid="verrou-deverrouiller">
          <ShieldCheck size={15} aria-hidden /> {t("verrou.deverrouiller")}
        </Button>
      </form>
      <p className="text-center text-[11px] text-faint">{t("verrou.aucuneDonnee")}</p>
    </div>
  );
}
