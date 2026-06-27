import { notFound } from "next/navigation";
import { getProche } from "@/features/famille/data/queries";
import { FichePersonne } from "@/features/famille/ui/FichePersonne";

export default async function FichePersonnePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProche(id);
  if (!data) notFound();
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <FichePersonne proche={data.proche} documents={data.documents} />
    </main>
  );
}
