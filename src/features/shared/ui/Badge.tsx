import type { HTMLAttributes } from "react";

export function Badge({ className = "", children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex min-w-6 items-center justify-center rounded-full bg-badge px-2 py-0.5 text-xs font-semibold text-ink ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
