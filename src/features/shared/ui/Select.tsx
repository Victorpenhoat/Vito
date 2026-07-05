import type { SelectHTMLAttributes } from "react";

const base =
  "w-full appearance-none rounded-control border bg-surface px-3 py-2 pr-9 text-ink outline-none transition-colors focus:outline-2 focus:outline-accent";

export function Select({
  label,
  error,
  className = "",
  children,
  ...rest
}: { label?: string; error?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  // Le chevron custom vit toujours dans un span relatif (mécanisme visuel), mais
  // le wrapper label/erreur (stack) n'apparaît que si demandé — ainsi <Select> est
  // un drop-in dans les rangées flex, comme les <select> nus qu'il remplace.
  const control = (
    <span className="relative block">
      <select
        className={`${base} ${error ? "border-danger" : "border-line"} ${className}`}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-faint"
      >
        ▾
      </span>
    </span>
  );
  if (!label && !error) return control;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium text-muted">{label}</span>}
      {control}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
