"use client";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "./CopyButton";
import { Modal } from "./Modal";
import { Button } from "./Button";

type Reponse = { ok: true; valeur: string } | { error: string } | undefined;

/**
 * Une valeur qu'on ne montre qu'après avoir redemandé le mot de passe.
 *
 * Générique : l'action de révélation est passée en paramètre, si bien qu'un
 * code d'accès et un numéro de pièce d'identité partagent le même geste sans
 * partager de code. La valeur en clair n'existe QUE dans cet état React, le
 * temps de la consultation — le serveur ne l'a jamais envoyée avec la page.
 */
export function ValeurProtegee({ id, masque, reveler, libelle }: {
  id: string;
  masque: string;
  reveler: (prev: unknown, formData: FormData) => Promise<Reponse>;
  libelle: string;
}) {
  const tp = useTranslations("protege");
  const [ouvert, setOuvert] = useState(false);
  const [valeur, setValeur] = useState<string | null>(null);
  const [state, action, pending] = useActionState(reveler, undefined);

  // On n'applique CHAQUE réponse qu'une fois : sinon un masquage manuel serait
  // aussitôt défait par la réponse encore en mémoire.
  const [derniere, setDerniere] = useState(state);
  if (state !== derniere) {
    setDerniere(state);
    if (state && "ok" in state && state.ok) { setValeur(state.valeur); setOuvert(false); }
  }

  return (
    <span className="flex items-center gap-1.5">
      <span data-testid="valeur-protegee" className="min-w-0 flex-1 truncate text-[13.5px] tracking-[0.06em] text-ink tabular-nums">
        {valeur ?? masque}
      </span>
      {valeur ? (
        <>
          <button type="button" data-testid="masquer-valeur" onClick={() => setValeur(null)}
            aria-label={tp("masquer")} aria-pressed
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface-hover text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
            <EyeOff size={13} aria-hidden />
          </button>
          <CopyButton value={valeur} label={tp("copier")} />
        </>
      ) : (
        <button type="button" data-testid="reveler-valeur" onClick={() => setOuvert(true)}
          aria-label={`${tp("reveler")} — ${libelle}`} aria-pressed={false}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface-hover text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
          <Eye size={13} aria-hidden />
        </button>
      )}

      <Modal open={ouvert} onClose={() => setOuvert(false)} title={tp("confirmer.titre")}>
        <form action={action} data-testid="reauth-form" className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <p className="text-[13px] text-muted">{tp("confirmer.pourquoi")}</p>
          <input type="password" name="motDePasse" autoComplete="current-password"
            data-testid="reauth-mot-de-passe" aria-label={tp("confirmer.motDePasse")}
            placeholder={tp("confirmer.motDePasse")}
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
          {state && "error" in state && state.error && (
            <p role="alert" className="text-[12.5px] text-danger">{state.error}</p>
          )}
          <Button type="submit" pending={pending} data-testid="reauth-valider">{tp("confirmer.verifier")}</Button>
        </form>
      </Modal>
    </span>
  );
}
