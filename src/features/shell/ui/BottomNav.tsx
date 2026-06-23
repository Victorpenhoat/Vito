"use client";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { NAV_ICONS } from "./Sidebar";
import { BOTTOM_KEYS, type NavEntry } from "../nav-config";

export function BottomNav({
  items, pathname, onMore,
}: { items: NavEntry[]; pathname: string; onMore: () => void }) {
  const t = useTranslations("nav");
  const bottom = BOTTOM_KEYS.map((k) => items.find((i) => i.key === k)).filter(Boolean) as NavEntry[];
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-sidebar md:hidden"
    >
      {bottom.map((it) => {
        const Icon = NAV_ICONS[it.key];
        const active = pathname.startsWith(it.href);
        return (
          <Link
            key={it.key}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${active ? "text-accent" : "text-muted"}`}
          >
            <Icon size={20} />
            {t(it.key)}
          </Link>
        );
      })}
      <button
        type="button"
        data-testid="drawer-open"
        onClick={onMore}
        className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-muted"
      >
        <MoreHorizontal size={20} />
        {t("plus")}
      </button>
    </nav>
  );
}
