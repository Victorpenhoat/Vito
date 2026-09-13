import type { ReactNode } from "react";

type TonChip =
  | "defaut" | "selectionne" | "actif-doux" | "vide" | "ajout" | "suggere"
  | "succes" | "alerte" | "danger";

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
  // MESURÉ : --accent sur --accent-50 ne donne que 4,17:1 en thème clair, sous le
  // seuil, sur des libellés de 10 à 11 px. Le texte passe en --ink (12,33 à
  // 16,36:1) ; le ton reste porté par le fond et la bordure, comme StatTile.
  "actif-doux": "border border-accent/25 bg-accent-50 font-semibold text-ink",
  vide: "border border-line-soft bg-surface-hover text-faint opacity-50",
  // `ajout` souffrait de la MÊME paire, mais appelle un autre remède : ici
  // l'accent EST l'affordance (« + Ajouter »), le passer en --ink l'effacerait.
  // C'est donc le fond teinté qui s'en va — --accent sur --surface tient 4,78:1
  // en clair, 7,02:1 en sombre — et la bordure tiretée porte toujours le signal.
  ajout: "border border-dashed border-accent/40 bg-surface text-accent",
  suggere: "border border-line bg-surface text-muted hover:border-accent/30 hover:text-ink",

  // Trois tons SÉMANTIQUES : un badge qui dit un état métier, pas une sélection.
  // Même forme que StatTile — fond teinté, bordure teintée, texte --ink — parce
  // que la forme teinte-sur-teinte échoue en thème clair (4,27 à 4,36:1).
  succes: "border border-kpi-green/25 bg-kpi-green-bg text-ink",
  alerte: "border border-kpi-amber/25 bg-kpi-amber-bg text-ink",
  danger: "border border-danger/25 bg-danger-bg text-ink",
};

// Union discriminée : `libelleRetrait` est obligatoire avec `onRetirer`, interdit sans lui.
// La première branche rend un chip sans croix de retrait ; la seconde le rend avec.
type TagChipProps =
  | {
    ton?: TonChip; couleur?: string; compte?: number; pressed?: boolean;
    onClick?: () => void; onRetirer?: never; libelleRetrait?: never;
    testId?: string; children: ReactNode;
  }
  | {
    ton?: TonChip; couleur?: string; compte?: number; pressed?: boolean;
    onClick?: () => void; onRetirer: () => void; libelleRetrait: string;
    testId?: string; children: ReactNode;
  };

export function TagChip({
  ton = "defaut", couleur, compte, pressed, onClick, onRetirer, libelleRetrait, testId, children,
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
  //
  // Un chip de filtre est un interrupteur : sans aria-pressed, un lecteur
  // d'écran ne dit pas si le filtre est posé. Les tons de basculement sont
  // `defaut` (off), `selectionne` (on) et `actif-doux` (on). Les tones
  // `ajout` et `suggere` sont des actions uniques, jamais des toggles — d'où
  // la valeur dérivée par défaut, ci-dessous.
  //
  // `pressed` est une échappatoire explicite : dériver l'état depuis `ton`
  // couple la sémantique (bascule ou non) à la présentation (couleur). Un chip
  // d'action ponctuelle qui emprunte par ailleurs un ton `defaut` ou
  // `selectionne` — par exemple pour matcher une palette — se ferait sinon
  // annoncer à tort comme un interrupteur. `pressed`, quand il est fourni
  // (y compris `false`), l'emporte sur la dérivation ; omis, le comportement
  // actuel est inchangé.
  const pressedDerive =
    ton === "defaut" || ton === "selectionne" || ton === "actif-doux"
      ? ton === "selectionne" || ton === "actif-doux"
      : undefined;
  const pressedFinal = pressed ?? pressedDerive;

  const principal = onClick ? (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      {...(pressedFinal !== undefined ? { "aria-pressed": pressedFinal } : {})}
      disabled={ton === "vide"}
      className={`${classe} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none`}
    >
      {contenu}
    </button>
  ) : (
    // `testId` vaut aussi pour un chip qui décrit : il était posé sur la seule
    // branche bouton, donc inerte sur la moitié des rendus — une prop publique
    // documentée qui ne faisait rien. Les e2e ciblent des badges descriptifs
    // (« demande-statut », « totp-actif », « session-courante »…) : sans cela,
    // les migrer perdrait leurs points d'accroche en silence.
    <span data-testid={testId} className={classe}>
      {contenu}
    </span>
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
