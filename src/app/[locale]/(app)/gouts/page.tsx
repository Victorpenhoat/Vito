import { getTranslations } from "next-intl/server";
import { GoutsForm } from "@/features/reco/ui/GoutsForm";
import { getGouts } from "@/features/reco/data/queries";
import { getTags } from "@/features/restos/data/queries";

export default async function GoutsPage() {
  const t = await getTranslations("gouts");
  const [tags, gouts] = await Promise.all([getTags(), getGouts()]);
  const initial = {
    ambiances: gouts?.ambiances ?? [],
    budgetMax: gouts?.budget_max ?? null,
    typesPreferes: gouts?.types_preferes ?? [],
    zones: gouts?.zones ?? [],
  };
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <GoutsForm tags={tags.map((x) => ({ slug: x.slug, label: x.label }))} initial={initial} />
    </main>
  );
}
