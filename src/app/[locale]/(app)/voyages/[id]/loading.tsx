import { Skeleton } from "@/features/shared/ui/Skeleton";

export default function VoyageDetailLoading() {
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <Skeleton className="h-40 w-full rounded-card" />
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-28" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-card" />)}
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      </div>
    </main>
  );
}
