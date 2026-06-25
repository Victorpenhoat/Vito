import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/routing";

export function NavItem({
  icon,
  label,
  href,
  active,
  "data-testid": dataTestId,
}: {
  icon: ReactNode;
  label: string;
  href: string;
  active?: boolean;
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
      {label}
    </Link>
  );
}
