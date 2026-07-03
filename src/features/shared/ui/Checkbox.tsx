import type { InputHTMLAttributes, ReactNode } from "react";

// Case à cocher du kit : on garde l'input natif (sémantique, a11y, sélecteurs e2e
// input[type=checkbox]) et on le thème via accent-color, avec une taille et une zone
// de tap correctes en mobile — contre les « carrés blancs » collés au libellé.
export function Checkbox({
  label,
  className = "",
  ...rest
}: { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 py-1 text-sm text-ink ${className}`}>
      <input type="checkbox" className="h-5 w-5 shrink-0 accent-accent" {...rest} />
      {label}
    </label>
  );
}
