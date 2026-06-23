"use client";
import { useTranslations } from "next-intl";
import {
  Home, Utensils, Wine, Search, Plane, Users, Wallet, ConciergeBell, CreditCard, Briefcase, Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavItem } from "@/features/shared/ui/NavItem";
import type { NavEntry, NavKey } from "../nav-config";
import { ShellFooter } from "./ShellFooter";

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  accueil: Home, restos: Utensils, vins: Wine, recherche: Search, voyages: Plane,
  famille: Users, depenses: Wallet, conciergerie: ConciergeBell, abonnement: CreditCard,
  agence: Briefcase, admin: Shield,
};

export function Sidebar({
  items, userName, role, pathname,
}: { items: NavEntry[]; userName: string; role: string; pathname: string }) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  return (
    <aside
      data-testid="sidebar"
      className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-4 border-r border-line bg-sidebar p-4 md:flex"
    >
      <div className="flex items-center gap-2 px-1 py-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-bold text-white">V</span>
        <span className="text-lg font-extrabold uppercase tracking-wide">{tApp("name")}</span>
      </div>
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
    </aside>
  );
}
