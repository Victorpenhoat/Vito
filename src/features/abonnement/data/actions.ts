"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/services/payment";
import { subscribeSchema } from "../domain/schemas";

export async function subscribe(_prev: unknown, formData: FormData) {
  const parsed = subscribeSchema.safeParse({ period: formData.get("period") });
  if (!parsed.success) return { error: "Période invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { data: existing } = await supabase
    .from("subscriptions").select("stripe_customer_id").eq("user_id", auth.user.id).maybeSingle();
  const result = await getPaymentProvider().checkout({
    period: parsed.data.period,
    userId: auth.user.id,
    email: auth.user.email ?? "",
    customerId: existing?.stripe_customer_id ?? undefined,
  });
  if (result.mode === "redirect") return { redirect: result.url }; // Stripe réel
  const { error } = await supabase.rpc("mock_subscribe", { p_period: parsed.data.period });
  if (error) { logActionError("abonnement.subscribe", error); return { error: "Souscription échouée" }; }
  revalidatePath("/abonnement");
  revalidatePath("/voyages");
  return { ok: true as const };
}

export async function manageSubscription(_prev: unknown, _formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { data: sub } = await supabase
    .from("subscriptions").select("stripe_customer_id").eq("user_id", auth.user.id).maybeSingle();
  if (!sub?.stripe_customer_id) return { error: "Aucun abonnement à gérer" };
  try {
    const url = await getPaymentProvider().portalUrl(sub.stripe_customer_id);
    return { redirect: url };
  } catch (err) {
    logActionError("abonnement.manageSubscription", err);
    return { error: "Gestion indisponible" };
  }
}

export async function cancelSubscription(_prev: unknown, _formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("cancel_subscription");
  if (error) { logActionError("abonnement.cancelSubscription", error); return { error: "Annulation échouée" }; }
  revalidatePath("/abonnement");
  return { ok: true as const };
}
