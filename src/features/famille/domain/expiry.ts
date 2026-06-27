export function expiryStatus(expiry: string | null, now: Date): "expired" | "soon" | "valid" | null {
  if (!expiry) return null;
  const d = new Date(expiry);
  if (d.getTime() < now.getTime()) return "expired";
  const sixMonths = new Date(now);
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  return d.getTime() < sixMonths.getTime() ? "soon" : "valid";
}

export function monthsUntil(expiry: string, now: Date): number {
  const d = new Date(expiry);
  if (d.getTime() <= now.getTime()) return 0;
  let months = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  if (d.getDate() < now.getDate()) months -= 1;
  return Math.max(0, months);
}
