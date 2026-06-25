import type { ReactNode } from "react";

export function SectionLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
      {icon}
      {children}
    </p>
  );
}
