export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-control bg-line/60 ${className}`} aria-hidden="true" />;
}
