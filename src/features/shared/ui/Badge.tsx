import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-badge px-2 py-0.5 text-xs font-semibold text-ink">
      {children}
    </span>
  );
}
