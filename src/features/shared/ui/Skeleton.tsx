// Le canevas pulse l'OPACITÉ d'un aplat --badge : `animate-pulse` de Tailwind
// fait exactement cela, inutile d'écrire une animation à la main.
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-card bg-badge ${className}`} aria-hidden="true" />;
}
