"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import type { Proche } from "../data/queries";
import { Avatar } from "@/features/shared/ui/Avatar";
import { groupProches } from "../domain/groupes";

// Rail master-detail desktop (design Onglet_Cercle, écran web) : lignes plates,
// « moi » épinglé, point d'alerte discret, item actif surface + filet accent.
export function FamilleRail({ proches }: { proches: Proche[] }) {
  const t = useTranslations("famille");
  const pathname = usePathname();
  const { moi, groupes } = groupProches(proches);
  return (
    <nav data-testid="famille-rail" className="flex flex-col border-r border-line pr-5">
      <div className="flex items-center justify-between">
        <span className="font-serif text-lg text-ink">{t("cercleTitre")}</span>
        <Link href="/famille/proches/nouveau" className="text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">{t("proches.ajouter")}</Link>
      </div>
      <ul className="mt-3 flex flex-col">
        {moi && <RailRow key={moi.id} proche={moi} pathname={pathname} t={t} pinned />}
        {groupes.map((g) => (
          <li key={g.key}>
            <div className="mt-4 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">{t(`groupes.${g.key}`)}</div>
            <ul className="flex flex-col">
              {g.items.map((p) => <RailRow key={p.id} proche={p} pathname={pathname} t={t} />)}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function RailRow({ proche: p, pathname, t, pinned = false }: {
  proche: Proche; pathname: string; t: ReturnType<typeof useTranslations>; pinned?: boolean;
}) {
  const active = pathname === `/famille/proches/${p.id}`;
  const urgent = p.urgency === "expired" || p.urgency === "soon";
  return (
    <li>
      <Link
        href={`/famille/proches/${p.id}`}
        aria-current={active ? "page" : undefined}
        className={`-ml-2 flex items-center gap-3 border-l-2 py-2 pl-2 pr-1 focus-visible:outline-2 focus-visible:outline-accent ${
          active ? "border-accent bg-surface" : "border-transparent hover:bg-surface-hover"
        }`}
      >
        <Avatar name={`${p.first_name} ${p.last_name}`} size="md" color={p.avatar_color ?? undefined} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-[15px] text-ink">{p.first_name} {p.last_name}</span>
          <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
            {pinned ? t("relations.moi") : t(`relations.${p.relation}`)}
            {urgent && (
              <span
                className={`h-[5px] w-[5px] rounded-full ${p.urgency === "expired" ? "bg-danger" : "bg-kpi-amber"}`}
                role="img"
                aria-label={p.urgency === "expired" ? t("expiry.expire") : t("expiry.expireDans", { n: p.urgency_months ?? 0 })}
              />
            )}
          </span>
        </span>
        {pinned && <span className="shrink-0 rounded-full border border-accent/25 bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent">{t("proches.epingle")}</span>}
      </Link>
    </li>
  );
}
