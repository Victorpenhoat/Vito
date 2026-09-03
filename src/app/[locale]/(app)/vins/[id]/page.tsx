import { VinFiche } from "@/features/vins/ui/VinFiche";

export default async function VinFichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1200px]"><VinFiche id={id} /></main>;
}
