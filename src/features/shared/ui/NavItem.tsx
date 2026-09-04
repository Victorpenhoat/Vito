import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/routing";

export function NavItem({
  icon,
  label,
  href,
  active,
  badge,
  "data-testid": dataTestId,
}: {
  icon: ReactNode;
  label: string;
  href: string;
  active?: boolean;
  /** Nombre en attente (boîte de réception) : rien n'est affiché à zéro — un
   *  compteur à zéro attire l'œil pour rien. */
  badge?: number;
  "data-testid"?: string;
}) {
  return (
    <Link
      href={href}
      data-testid={dataTestId}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-control px-3 py-2.5 text-sm transition-colors ${
        active
          ? "border-l-2 border-accent bg-surface font-semibold text-ink"
          : "border-l-2 border-transparent font-medium text-muted hover:bg-surface-hover"
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span data-testid={dataTestId ? `${dataTestId}-badge` : undefined}
          className="ml-auto min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[10.5px] font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
