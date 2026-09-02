"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { changerStatut } from "../data/actions";
import { RESTO_STATUTS, type RestoStatut } from "../domain/statut";

const TONE: Record<RestoStatut, string> = {
  favori: "border-accent/25 bg-accent-50 text-accent",
  a_tester: "border-current/20 bg-kpi-amber-bg text-kpi-amber",
  teste: "border-line bg-surface-hover text-muted",
};

// Chip de statut modifiable en un tap (design : « À tester ▾ » / « ♥ Favori ▾ »).
export function StatutChip({ listeItemId, statut }: { listeItemId: string; statut: RestoStatut }) {
  const t = useTranslations("restos");
  const [open, setOpen] = useState(false);
  const [, action, pending] = useActionState(changerStatut, undefined);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" data-testid="statut-chip" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-accent ${TONE[statut]}`}>
        {statut === "favori" ? "♥ " : ""}{t(`statut.${statut}`)}
        <ChevronDown size={11} aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 flex w-40 flex-col overflow-hidden rounded-[6px] border border-line bg-surface shadow-lg">
          {RESTO_STATUTS.filter((s) => s !== statut).map((s) => (
            <form key={s} action={action} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="listeItemId" value={listeItemId} />
              <input type="hidden" name="statut" value={s} />
              <button type="submit" data-testid={`statut-option-${s}`} disabled={pending}
                className="w-full px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
                {s === "favori" ? "♥ " : ""}{t(`statut.${s}`)}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
