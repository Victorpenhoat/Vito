import type { InputHTMLAttributes } from "react";

// Champ date du kit : habille l'input natif (le format d'affichage suit la locale du
// NAVIGATEUR — jj/mm/aaaa pour un navigateur fr — et le picker mobile natif est conservé,
// choix assumé vs un calendrier custom). L'icône du picker suit le thème via la règle
// color-scheme de globals.css.
export function DateField({
  label,
  error,
  className = "",
  ...rest
}: { label?: string; error?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium text-muted">{label}</span>}
      <input
        type="date"
        className={`rounded-control border bg-surface px-3 py-2 text-ink outline-none transition-colors placeholder:text-faint focus:outline-2 focus:outline-accent ${
          error ? "border-danger" : "border-line"
        } ${className}`}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
