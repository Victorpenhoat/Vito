import type { HTMLAttributes } from "react";

type Ton = "accent" | "alerte" | "neutre";

// `text-on-fill` sur les deux aplats : 7,54:1 sur l'accent, 9,36:1 sur l'ambre.
// Le canevas propose un brun (#2A1A08) sur l'ambre ; le rôle y fait mieux et
// évite d'ajouter une teinte de plus à la table.
const TON: Record<Ton, string> = {
  accent: "bg-accent text-on-fill",
  alerte: "bg-kpi-amber text-on-fill",
  neutre: "border border-line bg-badge text-muted",
};

export function CountBadge({
  ton = "neutre",
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { ton?: Ton }) {
  return (
    <span
      className={`inline-grid min-w-5 place-items-center rounded-pill px-1.5 py-0.5 text-[11px] font-semibold ${TON[ton]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
