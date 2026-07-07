import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";
import { isPremiumFrom } from "../domain/premium";

export async function getSubscription() {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("subscriptions")
    .select("status, period, current_period_end, stripe_customer_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return data;
}

export async function getIsPremium(): Promise<boolean> {
  const sub = await getSubscription();
  return isPremiumFrom(sub ? { status: sub.status, currentPeriodEnd: sub.current_period_end } : null, new Date());
}
