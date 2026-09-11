import type { ReactNode } from "react";

type Ton = "accent" | "neutre";

const TON: Record<Ton, { texte: string; pastille: string; filet: string }> = {
  // « Mes favoris » : ce qui appartient à l'utilisateur.
  accent: {
    texte: "text-accent",
    pastille: "border border-accent/30 bg-accent-50 text-accent",
    filet: "bg-accent/20",
  },
  // « Ailleurs · Google Places » : ce qui vient d'un tiers.
  neutre: {
    texte: "text-faint",
    pastille: "border border-line bg-badge text-muted",
    filet: "bg-line",
  },
};

export function SectionLabel({
  icon,
  badge,
  ton = "neutre",
  children,
}: { icon?: ReactNode; badge?: ReactNode; ton?: Ton; children: ReactNode }) {
  const t = TON[ton];
  return (
    <p className={`mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] ${t.texte}`}>
      {icon}
      <span>{children}</span>
      {badge != null && (
        <span className={`rounded-pill px-2 py-0.5 text-[10px] ${t.pastille}`}>{badge}</span>
      )}
      {/* Le filet occupe la largeur restante : c'est lui qui fait de l'étiquette
          une séparation, et non un simple titre. */}
      <span aria-hidden="true" className={`h-px flex-1 ${t.filet}`} />
    </p>
  );
}
