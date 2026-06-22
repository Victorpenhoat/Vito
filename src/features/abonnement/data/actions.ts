"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/services/payment";
import { subscribeSchema } from "../domain/schemas";

export async function subscribe(_prev: unknown, formData: FormData) {
  const parsed = subscribeSchema.safeParse({ period: formData.get("period") });
  if (!parsed.success) return { error: "Période invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const result = await getPaymentProvider().checkout({ period: parsed.data.period });
  if (result.mode === "redirect") return { redirect: result.url }; // Stripe réel (différé)
  const { error } = await supabase.rpc("mock_subscribe", { p_period: parsed.data.period });
  if (error) return { error: "Souscription échouée" };
  revalidatePath("/abonnement");
  revalidatePath("/voyages");
  return { ok: true as const };
}

export async function cancelSubscription(_prev: unknown, _formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("cancel_subscription");
  if (error) return { error: "Annulation échouée" };
  revalidatePath("/abonnement");
  return { ok: true as const };
}
