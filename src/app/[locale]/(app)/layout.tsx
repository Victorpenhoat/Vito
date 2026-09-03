import { requireRole, getSessionRole } from "@/lib/rbac/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/features/shell/ui/AppShell";
import { NAV_ITEMS, filterNav, type Role } from "@/features/shell/nav-config";
import { VerrouApp } from "@/features/compte/ui/VerrouApp";

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
      .select("display_name, verrou_delai_minutes")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profile?.display_name) userName = profile.display_name;
    if (profile) delaiVerrou = profile.verrou_delai_minutes;
  }

  return (
    <AppShell items={filterNav(NAV_ITEMS, role)} role={role} userName={userName}>
      {/* Verrouillage de l'app (lot O-D) : masque le carnet après inactivité.
          Protection d'affichage — les gardes serveur restent indépendantes. */}
      <VerrouApp delaiMinutes={delaiVerrou} />
      {children}
    </AppShell>
  );
}
