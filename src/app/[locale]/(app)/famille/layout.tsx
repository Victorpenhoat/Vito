import { getProches } from "@/features/famille/data/queries";
import { FamilleRail } from "@/features/famille/ui/FamilleRail";

export default async function FamilleLayout({ children }: { children: React.ReactNode }) {
  const proches = await getProches();
  return (
    <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 lg:p-8">
      <div className="hidden lg:block">{proches.length > 0 && <FamilleRail proches={proches} />}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
