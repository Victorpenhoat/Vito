import { Search, X } from "lucide-react";

// Quatre états au canevas : repos, survol, focus (le focus garde l'épaisseur
// de bordure à 1 px, seule sa couleur passe à l'accent, plus un halo
// --accent-50 ; le canevas prescrit 1,5 px, écart assumé pour rester sur
// l'échelle Tailwind par défaut), hors connexion (éteint). Le focus est porté
// par `focus-within` parce que c'est le CONTENEUR qui se pare, pas l'input nu.
export function SearchField({
  valeur, onChange, placeholder, horsLigne, libelleEffacer, testId, className = "",
}: {
  valeur: string; onChange: (v: string) => void; placeholder: string;
  horsLigne?: boolean; libelleEffacer: string; testId?: string; className?: string;
}) {
  return (
    // `<div>` et non `<label>` : le modèle de contenu HTML n'autorise qu'un
    // seul élément « labelable » dans un <label>, et ce conteneur porte à la
    // fois l'<input> et le <button> d'effacement. L'input garde son propre
    // aria-label (le placeholder) ; rien n'est perdu à l'accessibilité.
    <div
      className={`flex min-w-0 items-center gap-2.5 rounded-card border bg-surface-hover px-3.5 py-2.5 transition-colors ${
        horsLigne
          ? "border-line-soft opacity-60"
          : "border-line hover:border-line-strong hover:bg-badge focus-within:border-accent focus-within:bg-surface-hover focus-within:ring-3 focus-within:ring-accent-50"
      } ${className}`}
    >
      <Search size={15} aria-hidden className={`shrink-0 ${horsLigne ? "text-faint" : "text-muted"}`} />
      <input
        type="search"
        data-testid={testId}
        value={valeur}
        disabled={horsLigne}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {valeur !== "" && !horsLigne && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={libelleEffacer}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-pill bg-badge text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X size={9} aria-hidden />
        </button>
      )}
    </div>
  );
}
