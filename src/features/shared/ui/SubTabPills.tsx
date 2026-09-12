// Actif : aplat --ink, texte --on-fill (16,70:1), compteur en retrait à 55 %
// comme au canevas. Inactif : surface levée bordée, compteur en --faint.
export function SubTabPills<T extends string>({
  options, valeur, onChange, testId, idOnglet, ariaControls, ariaLabel,
}: {
  options: { cle: T; libelle: string; compte?: number }[];
  valeur: T;
  onChange: (cle: T) => void;
  testId?: (cle: T) => string;
  idOnglet?: (cle: T) => string;
  ariaControls?: string;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel}
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 [scrollbar-width:none]">
      {options.map((o) => {
        const actif = o.cle === valeur;
        return (
          <button key={o.cle} type="button" role="tab" aria-selected={actif}
            id={idOnglet?.(o.cle)} aria-controls={ariaControls}
            data-testid={testId?.(o.cle)} onClick={() => onChange(o.cle)}
            className={`shrink-0 whitespace-nowrap rounded-pill px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              actif
                ? "bg-ink font-semibold text-on-fill"
                : "border border-line bg-surface-hover text-muted hover:border-line-strong hover:text-ink"
            }`}>
            {o.libelle}
            {o.compte != null && (
              <span className={`ml-1.5 ${actif ? "opacity-55" : "text-faint"}`}>{o.compte}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
