import type { ReactNode } from "react";

type TonChip = "defaut" | "selectionne" | "actif-doux" | "vide" | "ajout" | "suggere";

// Relevé au canevas, bloc « Composants ». Le sélectionné pose --on-fill sur
// --ink : 16,70:1. Le vide garde --faint sur --surface-hover (3,69:1), ce qui
// est au-dessus du seuil des 3:1 applicable à un libellé désactivé.
//
// `actif-doux` n'est PAS au canevas : il vient du code existant, où les filtres
// de STATUT s'accumulent (plusieurs à la fois) là où un tag s'exclut (un seul).
// La nuance porte cette différence — l'aplatir sur `selectionne` ferait dire à
// l'interface qu'un filtre cumulatif est un choix unique.
const TON: Record<TonChip, string> = {
  defaut: "border border-line bg-surface-hover text-muted hover:border-line-strong hover:text-ink",
  selectionne: "bg-ink font-semibold text-on-fill",
  "actif-doux": "border border-accent/25 bg-accent-50 font-semibold text-accent",
  vide: "border border-line-soft bg-surface-hover text-faint opacity-50",
  ajout: "border border-dashed border-accent/40 bg-accent-50 text-accent",
  suggere: "border border-line bg-surface text-muted hover:border-accent/30 hover:text-ink",
};

// Union discriminée : `libelleRetrait` est obligatoire avec `onRetirer`, interdit sans lui.
// La première branche rend un chip sans croix de retrait ; la seconde le rend avec.
type TagChipProps =
  | {
    ton?: TonChip; couleur?: string; compte?: number;
    onClick?: () => void; onRetirer?: never; libelleRetrait?: never;
    testId?: string; children: ReactNode;
  }
  | {
    ton?: TonChip; couleur?: string; compte?: number;
    onClick?: () => void; onRetirer: () => void; libelleRetrait: string;
    testId?: string; children: ReactNode;
  };

export function TagChip({
  ton = "defaut", couleur, compte, onClick, onRetirer, libelleRetrait, testId, children,
}: TagChipProps) {
  const classe = `inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs transition-colors ${TON[ton]}`;
  const contenu = (
    <>
      {couleur && (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill" style={{ background: couleur }} />
      )}
      {children}
      {compte != null && <span className="opacity-50">{compte}</span>}
    </>
  );

  // Un chip qui décrit n'est pas cliquable : le rendre bouton promettrait une
  // action qui n'existe pas, et le lecteur d'écran l'annoncerait comme telle.
  const principal = onClick ? (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      // Un chip de filtre est un interrupteur : sans aria-pressed, un lecteur
      // d'écran ne dit pas si le filtre est posé. Les tons de basculement sont
      // `defaut` (off), `selectionne` (on) et `actif-doux` (on). Les tones
      // `ajout` et `suggere` sont des actions uniques, jamais des toggles.
      {...(ton === "defaut" || ton === "selectionne" || ton === "actif-doux" ? {
        "aria-pressed": ton === "selectionne" || ton === "actif-doux",
      } : {})}
      disabled={ton === "vide"}
      className={`${classe} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none`}
    >
      {contenu}
    </button>
  ) : (
    <span className={classe}>{contenu}</span>
  );

  if (!onRetirer) return principal;

  // La croix vit À CÔTÉ du chip, jamais dedans : un <button> imbriqué dans un
  // <button> est du HTML invalide, et le clavier n'atteint plus l'un des deux.
  return (
    <span className="inline-flex items-center gap-1">
      {principal}
      <button
        type="button"
        onClick={onRetirer}
        aria-label={libelleRetrait}
        className="grid h-5 w-5 place-items-center rounded-pill bg-badge text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        ×
      </button>
    </span>
  );
}
