import { requireRole, getSessionRole } from "@/lib/rbac/guards";
import { AppNav } from "@/features/shell/ui/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["client", "agence", "admin"]);
  const role = (await getSessionRole()) ?? "client";
  return (
    <div className="min-h-dvh">
      <AppNav role={role} />
      <div className="mx-auto max-w-5xl">{children}</div>
    </div>
  );
}
