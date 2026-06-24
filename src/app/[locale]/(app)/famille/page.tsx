import { getTranslations } from "next-intl/server";
import { getMaFamille, getFamilleRestos } from "@/features/famille/data/queries";
import { FamilleForm } from "@/features/famille/ui/FamilleForm";
import { InviteForm } from "@/features/famille/ui/InviteForm";
import { MembresList } from "@/features/famille/ui/MembresList";
import { FamilleRestos } from "@/features/famille/ui/FamilleRestos";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function FamillePage() {
  const t = await getTranslations("famille");
  const ma = await getMaFamille();
  if (!ma) {
    return (
      <main className="p-4 md:p-6 flex flex-col gap-6">
        <PageHeader title={t("title")} />
        <FamilleForm />
      </main>
    );
  }
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const currentProfileId = auth.user?.id ?? "";
  const restos = await getFamilleRestos(ma.famille.id);
  return (
    <main className="p-4 md:p-6 flex flex-col gap-6">
      <PageHeader title={ma.famille.nom} />
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-ink">{t("membres")}</h2>
        <MembresList membres={ma.membres} isOwner={ma.isOwner} currentProfileId={currentProfileId} />
        {ma.isOwner && <InviteForm />}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-ink">{t("restos")}</h2>
        <FamilleRestos restos={restos} />
      </section>
    </main>
  );
}
