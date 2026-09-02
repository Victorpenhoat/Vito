import { getTranslations } from "next-intl/server";
import { getMaFamille, getFamilleRestos } from "@/features/famille/data/queries";
import { FamilleForm } from "@/features/famille/ui/FamilleForm";
import { InviteForm } from "@/features/famille/ui/InviteForm";
import { MembresList } from "@/features/famille/ui/MembresList";
import { FamilleRestos } from "@/features/famille/ui/FamilleRestos";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

// Foyer partagé (compte multi-profils + restos partagés), sorti de la liste Cercle
// lors de la refonte (design Onglet_Cercle) : la liste reste un carnet de personnes,
// le foyer « comptes » vit sur sa propre page.
export default async function FoyerPage() {
  const t = await getTranslations("famille");
  const ma = await getMaFamille();
  return (
    <main className="flex flex-col gap-8 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrowFoyer")} title={t("foyerPartage")} />
      {!ma ? <FamilleForm /> : <FoyerPartage ma={ma} />}
    </main>
  );
}

type MaFamille = NonNullable<Awaited<ReturnType<typeof getMaFamille>>>;

async function FoyerPartage({ ma }: { ma: MaFamille }) {
  const t = await getTranslations("famille");
  const restos = await getFamilleRestos(ma.famille.id);
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const currentProfileId = auth.user?.id ?? "";
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-serif text-2xl text-ink">{ma.famille.nom}</h2>
      <MembresList membres={ma.membres} isOwner={ma.isOwner} currentProfileId={currentProfileId} />
      {ma.isOwner && <InviteForm />}
      <SectionLabel>{t("restos")}</SectionLabel>
      <FamilleRestos restos={restos} />
    </div>
  );
}
