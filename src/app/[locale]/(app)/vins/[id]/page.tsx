import { VinDetail } from "@/features/vins/ui/VinDetail";

export default async function VinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="p-6"><VinDetail id={id} /></main>;
}
