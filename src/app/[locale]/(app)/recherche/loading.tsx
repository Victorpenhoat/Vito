import { Skeleton } from "@/features/shared/ui/Skeleton";

export default function RechercheLoading() {
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-56" />
      </div>
      <div className="flex flex-col">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-soft py-3">
            <Skeleton className="h-14 w-14 shrink-0 rounded-control" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
