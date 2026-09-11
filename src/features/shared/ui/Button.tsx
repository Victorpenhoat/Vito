import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "subtle";

// `text-on-fill` et non `text-white` : le blanc ne s'inverse pas avec le thème,
// et sur l'accent sombre il tombe à 2,48:1. --on-fill y tient 7,54:1.
const VARIANT: Record<Variant, string> = {
  primary:
    "bg-accent text-on-fill hover:bg-accent-hover active:bg-accent-active disabled:bg-badge disabled:text-faint",
  ghost:
    "border border-line bg-transparent text-ink hover:border-line-strong hover:bg-surface-hover disabled:text-faint",
  subtle: "bg-surface text-muted hover:bg-surface-hover disabled:text-faint",
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
      className={`inline-flex items-center justify-center gap-2 rounded-card px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[.97] disabled:pointer-events-none ${VARIANT[variant]} ${className}`}
      disabled={pending || props.disabled}
      aria-busy={pending || undefined}
      {...props}
    >
      {/* Le canevas montre un disque qui tourne, pas un bouton simplement
          inerte : sans lui, une action lente est indistinguable d'un clic
          perdu. `border-current` le teint comme le texte, donc il suit la
          variante sans connaître sa couleur. */}
      {pending && (
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current/35 border-t-current"
        />
      )}
      {children}
    </button>
  );
}
