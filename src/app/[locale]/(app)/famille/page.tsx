import { getTranslations } from "next-intl/server";
import { getMaFamille, getFamilleRestos } from "@/features/famille/data/queries";
import { FamilleForm } from "@/features/famille/ui/FamilleForm";
import { InviteForm } from "@/features/famille/ui/InviteForm";
import { MembresList } from "@/features/famille/ui/MembresList";
import { FamilleRestos } from "@/features/famille/ui/FamilleRestos";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Card } from "@/features/shared/ui/Card";

export default async function FamillePage() {
  const t = await getTranslations("famille");
  const ma = await getMaFamille();
  if (!ma) {
    return (
      <main className="flex flex-col gap-6 p-4 md:p-8">
        <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
        <FamilleForm />
      </main>
    );
  }
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const currentProfileId = auth.user?.id ?? "";
  const restos = await getFamilleRestos(ma.famille.id);
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={ma.famille.nom} subtitle={`${ma.membres.length} · ${restos.length}`} />
      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-3">
          <SectionLabel>{t("membres")}</SectionLabel>
          <MembresList membres={ma.membres} isOwner={ma.isOwner} currentProfileId={currentProfileId} />
          {ma.isOwner && <InviteForm />}
        </section>
        <aside>
          <Card>
            <SectionLabel>{t("restos")}</SectionLabel>
            <div className="font-serif text-4xl font-medium text-ink">{restos.length}</div>
          </Card>
        </aside>
      </div>
      <section className="flex flex-col gap-3">
        <SectionLabel>{t("restos")}</SectionLabel>
        <FamilleRestos restos={restos} />
      </section>
    </main>
  );
}
