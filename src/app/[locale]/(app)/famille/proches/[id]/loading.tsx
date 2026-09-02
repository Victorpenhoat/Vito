import { Skeleton } from "@/features/shared/ui/Skeleton";

export default function FicheLoading() {
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-14" />
      </div>
      <div className="flex flex-col items-center gap-3 border-b border-line pb-6">
        <Skeleton className="h-[72px] w-[72px] rounded-full" />
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-3 w-24" />
        <div className="mt-2 flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[46px] w-[46px] rounded-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-40 w-full rounded-card" />
      </div>
    </main>
  );
}
