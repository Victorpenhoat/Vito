import { Skeleton } from "@/features/shared/ui/Skeleton";

export default function FamilleLoading() {
  return (
    <main className="flex flex-col gap-8 p-4 md:p-8">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-48" />
      </div>
      <section className="flex flex-col gap-4">
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
              <Skeleton className="h-[46px] w-[46px] rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
