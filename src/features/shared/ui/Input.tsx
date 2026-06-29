import type { InputHTMLAttributes } from "react";

export function Input({
  label,
  error,
  className = "",
  ...rest
}: { label?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium text-muted">{label}</span>}
      <input
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
