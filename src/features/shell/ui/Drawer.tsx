"use client";
import { NavGroups } from "./NavGroups";
import { ShellFooter } from "./ShellFooter";
import type { NavEntry } from "../nav-config";

export function Drawer({
  open, onClose, items, userName, role, pathname,
}: {
  open: boolean; onClose: () => void; items: NavEntry[]; userName: string; role: string; pathname: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose}>
      <div
        data-testid="drawer"
        className="absolute inset-y-0 left-0 flex w-72 flex-col gap-4 bg-sidebar p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <NavGroups items={items} pathname={pathname} />
        <ShellFooter userName={userName} role={role} />
      </div>
    </div>
  );
}
