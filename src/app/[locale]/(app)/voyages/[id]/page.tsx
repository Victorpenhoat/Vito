import { VoyageDetail } from "@/features/voyages/ui/VoyageDetail";

export default async function VoyageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="p-6"><VoyageDetail id={id} /></main>;
}
