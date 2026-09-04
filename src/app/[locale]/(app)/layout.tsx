import { requireRole, getSessionRole } from "@/lib/rbac/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/features/shell/ui/AppShell";
import { compterReception } from "@/features/reception/data/queries";
import { NAV_ITEMS, filterNav, type Role } from "@/features/shell/nav-config";
import { VerrouApp } from "@/features/compte/ui/VerrouApp";
import { CompteSuspendu } from "@/features/compte/ui/CompteSuspendu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["client", "agence", "admin"]);
  const role = ((await getSessionRole()) ?? "client") as Role;

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  let userName = auth.user?.email ?? "";
  let delaiVerrou = 5;
  if (auth.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, verrou_delai_minutes, suspendu_le")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profile?.display_name) userName = profile.display_name;
    if (profile) delaiVerrou = profile.verrou_delai_minutes;
    // Compte suspendu : la révocation des sessions coupe l'accès côté serveur,
    // cette garde coupe l'affichage immédiatement, sans attendre l'expiration
    // du jeton en cours.
    if (profile?.suspendu_le) return <CompteSuspendu />;
  }

  // Compteur de la boîte : une seule requête de comptage, sans charger les
  // cartes — le menu n'a besoin que du nombre.
  const enAttente = await compterReception();

  return (
    <AppShell items={filterNav(NAV_ITEMS, role)} role={role} userName={userName}
      compteurs={{ reception: enAttente }}>
      {/* Verrouillage de l'app (lot O-D) : masque le carnet après inactivité.
          Protection d'affichage — les gardes serveur restent indépendantes. */}
      <VerrouApp delaiMinutes={delaiVerrou} />
      {children}
    </AppShell>
  );
}
