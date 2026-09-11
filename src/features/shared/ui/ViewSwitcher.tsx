import type { ReactNode } from "react";

// Un rail bordé qui contient des segments : actif en aplat --ink, survol en
// --badge. Le canevas donne 11 px au rail et 8 px aux segments ; on emploie
// --radius-control (10 px) pour le rail et --radius-tile… non : les deux
// jetons ronds du lot 0 sont card (12) et control (10). Le rail prend control,
// les segments prennent control aussi — l'écart d'un pixel du canevas ne
// justifie pas un jeton de plus.
export function ViewSwitcher<T extends string>({
  options, valeur, onChange, testId,
}: {
  options: { cle: T; icone: ReactNode; libelle: string }[];
  valeur: T;
  onChange: (cle: T) => void;
  testId?: (cle: T) => string;
}) {
  return (
    <div className="flex shrink-0 gap-1 rounded-control border border-line bg-surface-hover p-0.5">
      {options.map((o) => {
        const actif = o.cle === valeur;
        return (
          <button key={o.cle} type="button" aria-pressed={actif} aria-label={o.libelle}
            data-testid={testId?.(o.cle)} onClick={() => onChange(o.cle)}
            className={`grid h-7 w-9 place-items-center rounded-control transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
              actif ? "bg-ink text-on-fill" : "text-muted hover:bg-badge hover:text-ink"
            }`}>
            {o.icone}
          </button>
        );
      })}
    </div>
  );
}
