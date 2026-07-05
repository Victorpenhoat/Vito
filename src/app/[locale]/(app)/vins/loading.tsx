import { Skeleton } from "@/features/shared/ui/Skeleton";

export default function VinsLoading() {
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="flex gap-4 border-b border-line pb-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-16" />)}
      </div>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="overflow-hidden rounded-card border border-line bg-surface">
            <Skeleton className="h-40 w-full" />
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
