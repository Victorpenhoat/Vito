"use client";
import { useState, type InputHTMLAttributes } from "react";

// Input fichier stylé : le natif (« Choose File No file chosen », non localisable) reste
// dans le DOM en sr-only — focus clavier, setInputFiles e2e et soumission de formulaire
// intacts — derrière un bouton visuel et le nom du fichier sélectionné.
export function FileField({
  label,
  emptyLabel,
  className = "",
  onChange,
  ...rest
}: { label: string; emptyLabel: string } & InputHTMLAttributes<HTMLInputElement>) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <label className={`flex cursor-pointer items-center gap-3 text-sm ${className}`}>
      <input
        type="file"
        className="peer sr-only"
        onChange={(e) => {
          setFileName(e.target.files?.[0]?.name ?? null);
          onChange?.(e);
        }}
        {...rest}
      />
      <span className="shrink-0 rounded-control border border-line px-3 py-2 text-ink transition-colors hover:bg-surface-hover peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
        {label}
      </span>
      <span className="min-w-0 truncate text-muted">{fileName ?? emptyLabel}</span>
    </label>
  );
}
