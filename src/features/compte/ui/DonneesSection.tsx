"use client";
import { useActionState, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { annulerSuppressionCompte, demanderSuppressionCompte } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

type Etape = 0 | 1 | 2 | 3;

// Données du compte (design Onboarding écran 16) : export et suppression en
// trois étapes, avec délai de rétractation.
export function DonneesSection({ inventaire, suppressionDemandeeLe, delaiJours }: {
  inventaire: { adresses: number; voyages: number; vins: number; proches: number };
  suppressionDemandeeLe: string | null;
  delaiJours: number;
}) {
  const t = useTranslations("compte");
  const format = useFormatter();
  const [etape, setEtape] = useState<Etape>(0);
  const [state, action, pending] = useActionState(demanderSuppressionCompte, undefined);
  // On garde le retour de l'action : sans lui, l'échec d'une annulation serait
  // silencieux — l'utilisateur croirait sa suppression annulée.
  const [annulation, annuler, pendingAnnul] = useActionState(
    async () => annulerSuppressionCompte(),
    undefined,
  );

  // Une demande en cours prend toute la place : c'est l'information la plus
  // importante de l'écran.
  if (suppressionDemandeeLe) {
    const echeance = new Date(new Date(suppressionDemandeeLe).getTime() + delaiJours * 86_400_000);
    return (
      <div data-testid="suppression-en-cours" className="flex flex-col gap-3 rounded-[5px] border border-current/20 bg-kpi-amber-bg px-3.5 py-3">
        <div>
          <div className="text-[13.5px] font-semibold text-kpi-amber">{t("donnees.suppressionEnCours")}</div>
          <p className="mt-1 text-[12.5px] text-ink">
            {t("donnees.effacementLe", { date: format.dateTime(echeance, { dateStyle: "long" }) })}
          </p>
          <p className="mt-1 text-[11.5px] text-muted">{t("donnees.annulationPossible")}</p>
        </div>
        {annulation && "error" in annulation && (
          <p role="alert" className="text-sm text-danger">{t("donnees.echecAnnulation")}</p>
        )}
        <form action={annuler}>
          <Button type="submit" pending={pendingAnnul} data-testid="annuler-suppression" className="py-2 text-xs">
            {t("donnees.annulerSuppression")}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div data-testid="donnees-section" className="flex flex-col gap-4 rounded-[5px] border border-line bg-surface px-3.5 py-3">
      <div className="flex flex-col gap-2">
        <div>
          <div className="text-[13.5px] text-ink">{t("donnees.exportTitre")}</div>
          <p className="mt-0.5 text-[11.5px] text-muted">{t("donnees.exportExplication")}</p>
        </div>
        {/* Téléchargement direct : aucun envoi d'e-mail n'est promis puisque
            aucun service d'envoi n'est configuré. */}
        <a href="/api/compte/export" download data-testid="exporter-donnees"
          className="inline-flex items-center gap-2 self-start rounded-control border border-line bg-surface-hover px-3.5 py-2 text-xs font-semibold text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">
          <Download size={13} aria-hidden /> {t("donnees.exporter")}
        </a>
      </div>

      <div className="border-t border-line-soft pt-3">
        <div className="text-[13.5px] text-ink">{t("donnees.suppressionTitre")}</div>

        {etape === 0 && (
          <button type="button" data-testid="commencer-suppression" onClick={() => setEtape(1)}
            className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-danger hover:underline">
            <Trash2 size={13} aria-hidden /> {t("donnees.supprimerCompte")}
          </button>
        )}

        {etape === 1 && (
          <div data-testid="suppression-etape-1" className="mt-2 flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              {t("donnees.etape", { n: 1, total: 3 })} · {t("donnees.cequiPart")}
            </div>
            <ul className="flex flex-col gap-1 text-[12.5px] text-ink">
              <li>{t("donnees.inventaire", inventaire)}</li>
              <li>{t("donnees.inventaireProches", { proches: inventaire.proches })}</li>
              <li>{t("donnees.inventaireInvites")}</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <a href="/api/compte/export" download
                className="rounded-control border border-line bg-surface-hover px-3 py-1.5 text-[11.5px] font-semibold text-ink">
                {t("donnees.exporterAvant")}
              </a>
              <button type="button" data-testid="suppression-suivant" onClick={() => setEtape(2)}
                className="rounded-control bg-danger px-3 py-1.5 text-[11.5px] font-semibold text-white">
                {t("donnees.continuer")}
              </button>
              <button type="button" onClick={() => setEtape(0)} className="text-[11.5px] text-muted hover:text-ink">
                {t("donnees.renoncer")}
              </button>
            </div>
          </div>
        )}

        {etape === 2 && (
          <div data-testid="suppression-etape-2" className="mt-2 flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              {t("donnees.etape", { n: 2, total: 3 })} · {t("donnees.retractation")}
            </div>
            <p className="text-[12.5px] text-ink">{t("donnees.delai", { jours: delaiJours })}</p>
            <p className="text-[11.5px] text-muted">{t("donnees.annulationPossible")}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setEtape(1)} className="text-[11.5px] text-muted hover:text-ink">
                {t("donnees.retour")}
              </button>
              <button type="button" data-testid="suppression-suivant-2" onClick={() => setEtape(3)}
                className="ml-auto rounded-control bg-danger px-3 py-1.5 text-[11.5px] font-semibold text-white">
                {t("donnees.continuer")}
              </button>
            </div>
          </div>
        )}

        {etape === 3 && (
          <form action={action} data-testid="suppression-etape-3" className="mt-2 flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              {t("donnees.etape", { n: 3, total: 3 })} · {t("donnees.confirmation")}
            </div>
            <p className="text-[12.5px] text-ink">{t("donnees.confirmezIdentite")}</p>
            <label className="flex flex-col gap-1 text-[11px] text-muted">
              {t("verrou.motDePasse")}
              <input type="password" name="motDePasse" required autoComplete="current-password"
                data-testid="suppression-mot-de-passe"
                className="w-full max-w-xs rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
            </label>
            {state && "error" in state && state.error && (
              <p role="alert" className="text-sm text-danger">{t("donnees.echecSuppression")}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setEtape(2)} className="text-[11.5px] text-muted hover:text-ink">
                {t("donnees.retour")}
              </button>
              <Button type="submit" pending={pending} data-testid="confirmer-suppression" className="ml-auto py-2 text-xs">
                <ShieldCheck size={13} aria-hidden /> {t("donnees.verifierEtSupprimer")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
