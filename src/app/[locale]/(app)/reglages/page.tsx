import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { getMonProfil } from "@/features/compte/data/queries";
import { ProfilForm } from "@/features/compte/ui/ProfilForm";
import { ReglagesSections } from "@/features/compte/ui/ReglagesSections";

// Réglages (design Onboarding_Compte, écran 13). Premier lot : profil, sommaire
// des sections et apparence ; Sécurité / Appareils / Partages / Données arrivent
// avec les lots suivants.
export default async function ReglagesPage() {
  const t = await getTranslations("compte");
  const profil = await getMonProfil();
  // Le layout (app) garde déjà la session ; sans profil, la page n'a pas de sens.
  if (!profil) notFound();

  return (
    <main className="flex flex-col gap-6 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[900px]">
      <PageHeader eyebrow={t("eyebrow")} title={t("titre")} />

      <section className="flex flex-col gap-2.5">
        <SectionLabel>{t("sections.profil")}</SectionLabel>
        <ProfilForm firstName={profil.first_name} lastName={profil.last_name} email={profil.email} />
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionLabel>{t("toutesSections")}</SectionLabel>
        <ReglagesSections role={profil.role} />
      </section>
    </main>
  );
}
