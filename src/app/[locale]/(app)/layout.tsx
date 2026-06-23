import { requireRole, getSessionRole } from "@/lib/rbac/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/features/shell/ui/AppShell";
import { NAV_ITEMS, filterNav, type Role } from "@/features/shell/nav-config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["client", "agence", "admin"]);
  const role = ((await getSessionRole()) ?? "client") as Role;

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  let userName = auth.user?.email ?? "";
  if (auth.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profile?.display_name) userName = profile.display_name;
  }

  return (
    <AppShell items={filterNav(NAV_ITEMS, role)} role={role} userName={userName}>
      {children}
    </AppShell>
  );
}
