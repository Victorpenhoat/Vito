import type { ReactNode } from "react";

// États vides du design (écran 11) : ils expliquent ce qu'on gagne à remplir,
// plutôt que de constater un vide.
export function EtatVide({ titre, explication, action }: {
  titre: string; explication: string; action?: ReactNode;
}) {
  return (
    <div data-testid="activites-vide" className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line bg-surface px-6 py-10 text-center">
      <p className="font-serif text-lg text-ink">{titre}</p>
      <p className="max-w-[34ch] text-[13px] leading-relaxed text-muted">{explication}</p>
      {action}
    </div>
  );
}
