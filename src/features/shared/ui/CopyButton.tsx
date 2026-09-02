"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

// Bouton « copier dans le presse-papier » du kit (fiche Cercle : numéros, téléphone…).
// Feedback inline (icône ✓ 1,5 s) plutôt qu'un toast : l'action est locale à la ligne.
export function CopyButton({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papier indisponible (permissions) : on n'affiche pas de faux succès */
    }
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); void copy(); }}
      aria-label={label}
      className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-line bg-surface-hover text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent ${className}`}
    >
      {copied ? <Check size={14} className="text-kpi-green" aria-hidden /> : <Copy size={14} aria-hidden />}
    </button>
  );
}
