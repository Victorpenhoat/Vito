import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { getActiviteDetail } from "@/features/activites/data/queries";
import { getProches } from "@/features/famille/data/queries";
import { FicheActivite } from "@/features/activites/ui/FicheActivite";
import { ListeActivites } from "@/features/activites/ui/ListeActivites";
import { ongletValide } from "@/features/activites/ui/SousOnglets";

// Fiche d'une activité. Sur grand écran, elle s'ouvre À CÔTÉ de la liste plutôt
// que de la remplacer — même composition que le carnet des restos. Sur
// téléphone, c'est la fiche seule.
export default async function ActivitePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("activites");
  const { id } = await params;
  const query = await searchParams;

  const maintenant = new Date();
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const heure = maintenant.toISOString().slice(11, 16);

  const [activite, proches] = await Promise.all([
    getActiviteDetail(id, aujourdhui, heure),
    getProches(),
  ]);
  // Inexistante ou pas à moi : la RLS ne distingue pas les deux, l'écran non
  // plus. Dire « elle existe mais pas pour vous » en dirait déjà trop.
  if (!activite) notFound();

  return (
    <main className="flex flex-col gap-4 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1400px]">
      <PageHeader eyebrow={t("eyebrow")} title={t("titre")} />
      <Link href="/activites" data-testid="fiche-retour"
        className="self-start text-[12.5px] font-semibold text-accent hover:underline lg:hidden">
        ← {t("titre")}
      </Link>
      <ListeActivites
        params={query}
        actif={ongletValide(typeof query.onglet === "string" ? query.onglet : undefined)}
        aujourdhui={aujourdhui}
        heure={heure}
        selectedId={id}
        detail={
          <FicheActivite activite={activite} aujourdhui={aujourdhui}
            membresDuFoyer={proches.map((p) => ({ id: p.id, prenom: p.first_name }))} />
        }
      />
    </main>
  );
}
