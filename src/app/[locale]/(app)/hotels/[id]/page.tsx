import { FicheResto } from "@/features/restos/ui/FicheResto";

export default async function HotelFichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="p-4 md:p-6"><FicheResto etablissementId={id} category="hotel" /></main>;
}
