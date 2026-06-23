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
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-accent-50 text-ink" : "text-muted hover:bg-surface-hover"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
