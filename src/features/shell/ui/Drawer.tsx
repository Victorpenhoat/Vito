"use client";
import { useTranslations } from "next-intl";
import { NavItem } from "@/features/shared/ui/NavItem";
import { NAV_ICONS } from "./Sidebar";
import { ShellFooter } from "./ShellFooter";
import type { NavEntry } from "../nav-config";

export function Drawer({
  open, onClose, items, userName, role, pathname,
}: {
  open: boolean; onClose: () => void; items: NavEntry[]; userName: string; role: string; pathname: string;
}) {
  const t = useTranslations("nav");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose}>
      <div
        data-testid="drawer"
        className="absolute inset-y-0 left-0 flex w-72 flex-col gap-4 bg-sidebar p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {items.map((it) => {
            const Icon = NAV_ICONS[it.key];
            return (
              <NavItem
                key={it.key}
                data-testid={`nav-${it.key}`}
                icon={<Icon size={18} />}
                label={t(it.key)}
                href={it.href}
                active={pathname.startsWith(it.href)}
              />
            );
          })}
        </nav>
        <ShellFooter userName={userName} role={role} />
      </div>
    </div>
  );
}
