import { Skeleton } from "@/features/shared/ui/Skeleton";

export default function FamilleLoading() {
  return (
    <main className="flex flex-col gap-4 p-4 md:p-8">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-11 w-11 rounded-full" />
      </div>
      <Skeleton className="h-[46px] w-full" />
      <div className="mt-2 flex flex-col">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3.5 border-b border-line-soft py-3.5">
            <Skeleton className="h-[46px] w-[46px] rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
