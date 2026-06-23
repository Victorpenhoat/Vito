import type { ReactNode } from "react";

const TONE: Record<"info" | "success" | "error", string> = {
  info: "border-line text-ink",
  success: "border-kpi-green text-kpi-green",
  error: "border-red-500 text-red-400",
};

export function Toast({ type = "info", children }: { type?: "info" | "success" | "error"; children: ReactNode }) {
  return (
    <div className={`rounded-xl border bg-surface px-4 py-3 text-sm ${TONE[type]}`}>{children}</div>
  );
}
