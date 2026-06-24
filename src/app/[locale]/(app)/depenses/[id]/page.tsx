import { GroupeDetail } from "@/features/depenses/ui/GroupeDetail";

export default async function GroupeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="p-4 md:p-6"><GroupeDetail id={id} /></main>;
}
