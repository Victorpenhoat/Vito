import type { ReactNode } from "react";

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="mb-2 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      {action}
    </header>
  );
}
