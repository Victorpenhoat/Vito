export type SubscriptionRow = { status: string; currentPeriodEnd: string } | null;

// Miroir exact de la SQL public.is_premium : actif, ou annulé mais pas encore expiré.
export function isPremiumFrom(sub: SubscriptionRow, now: Date): boolean {
  if (!sub) return false;
  if (sub.status === "active") return true;
  if (sub.status === "canceled") return new Date(sub.currentPeriodEnd) > now;
  return false;
}
