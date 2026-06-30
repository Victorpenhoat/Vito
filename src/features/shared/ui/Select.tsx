import type { SelectHTMLAttributes } from "react";

export function Select({
  label,
  error,
  className = "",
  children,
  ...rest
}: { label?: string; error?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium text-muted">{label}</span>}
      <span className="relative">
        <select
          className={`w-full appearance-none rounded-control border bg-surface px-3 py-2 pr-9 text-ink outline-none transition-colors focus:outline-2 focus:outline-accent ${
            error ? "border-danger" : "border-line"
          } ${className}`}
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
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
