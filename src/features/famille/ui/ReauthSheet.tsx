"use client";
import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { ouvrirScanProtege } from "../data/actions";
import { Modal } from "@/features/shared/ui/Modal";
import { Button } from "@/features/shared/ui/Button";

// Feuille de re-authentification (design Onboarding écran 11), partagée par
// l'affichage et le partage d'un scan. Elle délivre un ticket à usage unique :
// une vérification ouvre UNE consultation (décision PO).
export function ReauthSheet({ open, onClose, docId, face = "recto", onTicket }: {
  open: boolean;
  onClose: () => void;
  docId: string;
  face?: "recto" | "verso";
  onTicket: (ticket: string) => void;
}) {
  const t = useTranslations("protege");
  const [state, action, pending] = useActionState(ouvrirScanProtege, undefined);

  useEffect(() => {
    if (state && "ok" in state && state.ok && state.ticket) {
      onTicket(state.ticket);
      onClose();
    }
    // `state` change à chaque soumission : ne dépend que de lui
  }, [state, onTicket, onClose]);

  return (
    <Modal open={open} onClose={onClose} title={t("confirmer.titre")}>
      <form action={action} data-testid="reauth-scan-form" className="flex flex-col gap-3">
        <input type="hidden" name="docId" value={docId} />
        <input type="hidden" name="face" value={face} />
        <p className="text-[12.5px] text-muted">{t("confirmer.pourquoi")}</p>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("confirmer.motDePasse")}
          <input type="password" name="motDePasse" required autoComplete="current-password"
            data-testid="reauth-scan-mot-de-passe"
            className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
        </label>
        {state && "error" in state && state.error && (
          <p role="alert" className="text-sm text-danger">{t("confirmer.echec")}</p>
        )}
        <Button type="submit" pending={pending}>
          <ShieldCheck size={15} aria-hidden /> {t("confirmer.verifier")}
        </Button>
        <p className="text-center text-[11px] text-faint">{t("chaqueRevelation")}</p>
      </form>
    </Modal>
  );
}
