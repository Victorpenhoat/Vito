import { Skeleton } from "@/features/shared/ui/Skeleton";

export default function AccueilLoading() {
  return (
    <main className="flex flex-col gap-6 p-4 pb-20 md:p-8 md:pb-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-3 w-24" />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 bg-surface p-4">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-32" />
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      </div>
    </main>
  );
}
