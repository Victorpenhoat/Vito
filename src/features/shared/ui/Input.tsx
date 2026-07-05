import type { InputHTMLAttributes } from "react";

const base =
  "rounded-control border bg-surface px-3 py-2 text-ink outline-none transition-colors placeholder:text-faint focus:outline-2 focus:outline-accent";

// Classe de champ du kit, pour les contrôles sans primitive dédiée (textarea) :
// évite de recopier la chaîne de style dans chaque formulaire.
export const fieldClass = `${base} border-line`;

export function Input({
  label,
  error,
  className = "",
  ...rest
}: { label?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const field = (
    <input
      className={`${base} ${error ? "border-danger" : "border-line"} ${className}`}
      aria-invalid={error ? true : undefined}
      {...rest}
    />
  );
  // Champ nu (ni label ni erreur) : on rend l'<input> directement pour rester
  // un drop-in dans les rangées flex des formulaires (pas de wrapper qui décale
  // la mise en page). Le wrapper label/erreur n'apparaît que si demandé.
  if (!label && !error) return field;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium text-muted">{label}</span>}
      {field}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
