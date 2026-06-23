"use client";
import { useState, type ReactNode } from "react";
import { usePathname } from "@/lib/i18n/routing";
import type { NavEntry, Role } from "../nav-config";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Drawer } from "./Drawer";

export function AppShell({
  items, role, userName, children,
}: { items: NavEntry[]; role: Role; userName: string; children: ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  return (
    <div data-testid="app-shell" className="min-h-dvh">
      <Sidebar items={items} userName={userName} role={role} pathname={pathname} />
      <BottomNav items={items} pathname={pathname} onMore={() => setDrawer(true)} />
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        items={items}
        userName={userName}
        role={role}
        pathname={pathname}
      />
      <div className="pb-16 md:pb-0 md:pl-64">{children}</div>
    </div>
  );
}
