import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "subtle";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  ghost: "bg-transparent text-ink border border-line hover:bg-surface-hover",
  subtle: "bg-surface text-muted hover:bg-surface-hover",
};

export function Button({
  variant = "primary",
  pending,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; pending?: boolean }) {
  return (
    <button
      className={`rounded-control px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${VARIANT[variant]} ${className}`}
      disabled={pending || props.disabled}
      {...props}
    >
      {children}
    </button>
  );
}
