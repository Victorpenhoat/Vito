import type { ReactNode } from "react";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-card border border-line bg-surface p-5 ${className}`}>{children}</div>
  );
}
