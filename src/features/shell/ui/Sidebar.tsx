"use client";
import { useTranslations } from "next-intl";
import { NavGroups } from "./NavGroups";
import type { NavEntry } from "../nav-config";
import { ShellFooter } from "./ShellFooter";

export function Sidebar({
  items, userName, role, pathname,
}: { items: NavEntry[]; userName: string; role: string; pathname: string }) {
  const tApp = useTranslations("app");
  return (
    <aside
      data-testid="sidebar"
      className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-4 border-r border-line bg-sidebar p-4 md:flex"
    >
      <div className="flex flex-col gap-0.5 px-1 py-2">
        <span className="text-lg font-extrabold uppercase tracking-[0.28em] text-ink">{tApp("name")}</span>
        <span className="font-serif text-sm italic text-faint">{tApp("subtitle")}</span>
      </div>
      <NavGroups items={items} pathname={pathname} />
      <ShellFooter userName={userName} role={role} />
    </aside>
  );
}
