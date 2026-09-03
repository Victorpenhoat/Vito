"use client";
import { useActionState, useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { revelerNumero } from "../data/actions";
import { CopyButton } from "@/features/shared/ui/CopyButton";
import { Modal } from "@/features/shared/ui/Modal";
import { Button } from "@/features/shared/ui/Button";

// Numéro protégé (design Onboarding écran 11). Le clair n'existe pas dans la
// page : le serveur n'envoie qu'un masque, et la valeur n'arrive qu'après
// vérification d'identité — redemandée à CHAQUE révélation (décision PO).
export function MaskedNumber({ docId, masque }: { docId: string; masque: string }) {
  const t = useTranslations("famille");
  const tp = useTranslations("protege");
  const [ouvert, setOuvert] = useState(false);
  const [numero, setNumero] = useState<string | null>(null);
  const [state, action, pending] = useActionState(revelerNumero, undefined);

  // La valeur révélée ne vit qu'en mémoire, le temps de la consultation.
  // On n'applique CHAQUE réponse qu'une fois : comparer au numéro affiché
  // ré-ouvrirait la valeur juste après un masquage manuel.
  const [derniereReponse, setDerniereReponse] = useState(state);
  if (state !== derniereReponse) {
    setDerniereReponse(state);
    if (state && "ok" in state && state.ok && state.numero) {
      setNumero(state.numero);
      setOuvert(false);
    }
  }

  return (
    <span className="flex items-center justify-between gap-3">
      <span className="truncate text-sm tracking-[0.06em] text-ink tabular-nums" data-testid="numero-protege">
        {numero ?? masque}
      </span>
      <span className="flex shrink-0 gap-1.5">
        {numero ? (
          <>
            <button type="button" data-testid="masquer-numero"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setNumero(null); }}
              aria-label={t("fiche.masquerNumero")} aria-pressed
              className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-line bg-surface-hover text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
              <EyeOff size={14} aria-hidden />
            </button>
            <CopyButton value={numero} label={t("fiche.copier")} />
          </>
        ) : (
          <button type="button" data-testid="reveler-numero"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOuvert(true); }}
            aria-label={t("fiche.revelerNumero")} aria-pressed={false}
            className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-line bg-surface-hover text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
            <Eye size={14} aria-hidden />
          </button>
        )}
      </span>

      <Modal open={ouvert} onClose={() => setOuvert(false)} title={tp("confirmer.titre")}>
        <form action={action} data-testid="reauth-form" className="flex flex-col gap-3">
          <input type="hidden" name="docId" value={docId} />
          <p className="text-[12.5px] text-muted">{tp("confirmer.pourquoi")}</p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {tp("confirmer.motDePasse")}
            <input type="password" name="motDePasse" required autoComplete="current-password"
              data-testid="reauth-mot-de-passe"
              className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
          </label>
          {state && "error" in state && state.error && (
            <p role="alert" className="text-sm text-danger">{tp("confirmer.echec")}</p>
          )}
          <Button type="submit" pending={pending}>
            <ShieldCheck size={15} aria-hidden /> {tp("confirmer.verifier")}
          </Button>
          <p className="text-center text-[11px] text-faint">{tp("chaqueRevelation")}</p>
        </form>
      </Modal>
    </span>
  );
}
