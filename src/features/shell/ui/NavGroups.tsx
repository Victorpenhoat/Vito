"use client";
import { useTranslations } from "next-intl";
import {
  Home, Utensils, Wine, Search, Plane, Users, Wallet, ConciergeBell, CreditCard, Briefcase, Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavItem } from "@/features/shared/ui/NavItem";
import { groupNav, type NavEntry, type NavKey } from "../nav-config";

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  accueil: Home, restos: Utensils, vins: Wine, recherche: Search, voyages: Plane,
  famille: Users, depenses: Wallet, conciergerie: ConciergeBell, abonnement: CreditCard,
  agence: Briefcase, admin: Shield,
};

export function NavGroups({ items, pathname }: { items: NavEntry[]; pathname: string }) {
  const t = useTranslations("nav");
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
      {groupNav(items).map(({ group, entries }) => (
        <div key={group} className="flex flex-col gap-1">
          <div className="mb-1 mt-4 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint first:mt-0">
            {t(`group.${group}`)}
          </div>
          {entries.map((it) => {
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
        </div>
      ))}
    </nav>
  );
}
