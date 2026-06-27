"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import type { Proche } from "../data/queries";
import { CIRCLES } from "../domain/schemas";
import { Avatar } from "@/features/shared/ui/Avatar";
import { ExpiryBadge } from "./ExpiryBadge";

export function FamilleRail({ proches }: { proches: Proche[] }) {
  const t = useTranslations("famille");
  const pathname = usePathname();
  return (
    <nav data-testid="famille-rail" className="flex flex-col gap-5 border-r border-line pr-5">
      <div className="flex items-center justify-between">
        <span className="font-serif text-lg text-ink">{t("proches.titre")}</span>
        <Link href="/famille/proches/nouveau" className="text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">{t("proches.ajouter")}</Link>
      </div>
      {CIRCLES.map((circle) => {
        const group = proches.filter((p) => p.circle === circle);
        if (group.length === 0) return null;
        return (
          <div key={circle} className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`circles.${circle}`)}</span>
            {group.map((p) => {
              const active = pathname === `/famille/proches/${p.id}`;
              return (
                <Link key={p.id} href={`/famille/proches/${p.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-control px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-accent ${active ? "bg-accent-50" : "hover:bg-surface-hover"}`}>
                  <Avatar name={`${p.first_name} ${p.last_name}`} size="sm" color={p.avatar_color ?? undefined} />
                  <span className="flex-1 truncate text-sm text-ink">{p.first_name} {p.last_name}</span>
                  {(p.urgency === "expired" || p.urgency === "soon") && <ExpiryBadge status={p.urgency} monthsLeft={p.urgency_months ?? undefined} />}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
