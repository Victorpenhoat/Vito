import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getMaFamille, getFamilleRestos, getProches } from "@/features/famille/data/queries";
import { FamilleForm } from "@/features/famille/ui/FamilleForm";
import { InviteForm } from "@/features/famille/ui/InviteForm";
import { MembresList } from "@/features/famille/ui/MembresList";
import { FamilleRestos } from "@/features/famille/ui/FamilleRestos";
import { ProchesList } from "@/features/famille/ui/ProchesList";
import { ProchesEmptyState } from "@/features/famille/ui/ProchesEmptyState";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Button } from "@/features/shared/ui/Button";

export default async function FamillePage() {
  const t = await getTranslations("famille");
  const proches = await getProches();
  const ma = await getMaFamille();

  return (
    <main className="flex flex-col gap-8 p-4 md:p-8">
      {/* Le CTA vit dans le slot action du header — un SectionLabel « Mes proches » sous le
          titre « Mes proches » dupliquait le même libellé trois fois avec les groupes de la liste. */}
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("proches.titre")}
        action={<Link href="/famille/proches/nouveau"><Button className="text-sm py-1.5">{t("proches.ajouter")}</Button></Link>}
      />

      {/* Répertoire de proches (héros) */}
      <section className="flex flex-col gap-4">
        {proches.length === 0 ? <ProchesEmptyState /> : <ProchesList proches={proches} />}
      </section>

      {/* Foyer partagé (bloc réutilisant l'existant) */}
      <section className="flex flex-col gap-4 border-t border-line pt-8">
        <SectionLabel>{t("membres")}</SectionLabel>
        {!ma ? <FamilleForm /> : <FoyerPartage ma={ma} />}
      </section>
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
