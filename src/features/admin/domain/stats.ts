import { isPremiumFrom } from "@/features/abonnement/domain/premium";

export type AdminData = {
  users: { id: string }[];
  subscriptions: { status: string; currentPeriodEnd: string }[];
  demandes: { statut: string }[];
};

export function computeAdminStats(data: AdminData, now: Date) {
  const demandesParStatut: Record<string, number> = {};
  for (const d of data.demandes) {
    demandesParStatut[d.statut] = (demandesParStatut[d.statut] ?? 0) + 1;
  }
  return {
    totalUsers: data.users.length,
    premiumActifs: data.subscriptions.filter((s) => isPremiumFrom(s, now)).length,
    demandesParStatut,
  };
}
