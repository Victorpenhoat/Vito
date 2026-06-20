import { requireRole } from "@/lib/rbac/guards";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["client", "agence", "admin"]);
  return <div className="min-h-dvh">{children}</div>;
}
