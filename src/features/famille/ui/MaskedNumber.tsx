"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { maskDocNumber } from "../domain/mask";
import { CopyButton } from "@/features/shared/ui/CopyButton";

// Numéro sensible masqué par défaut (règle du brief : jamais affiché sans action
// explicite) : révéler (œil) + copier. Utilisé fiche + détail document.
export function MaskedNumber({ number }: { number: string }) {
  const t = useTranslations("famille");
  const [revealed, setRevealed] = useState(false);
  return (
    <span className="flex items-center justify-between gap-3">
      <span className="truncate text-sm tracking-[0.06em] text-ink tabular-nums">
        {revealed ? number : maskDocNumber(number)}
      </span>
      <span className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setRevealed((v) => !v); }}
          aria-label={revealed ? t("fiche.masquerNumero") : t("fiche.revelerNumero")}
          aria-pressed={revealed}
          className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-line bg-surface-hover text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          {revealed ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
        </button>
        <CopyButton value={number} label={t("fiche.copier")} />
      </span>
    </span>
  );
}
