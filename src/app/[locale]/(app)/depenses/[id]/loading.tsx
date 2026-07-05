import { Skeleton } from "@/features/shared/ui/Skeleton";

export default function GroupeDetailLoading() {
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-card" />)}
        </div>
      </div>
    </main>
  );
}
