import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapStripeStatus, intervalToPeriod } from "../domain/stripeStatus";

// Écrit le miroir subscriptions depuis un event Stripe. Service-role (contourne la RLS
// lecture-seule) : c'est le seul chemin d'écriture réel. Idempotent (upsert par user_id).
export async function syncSubscriptionFromEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
  let userId: string | null = null;
  let subscriptionId: string | null = null;

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    userId = s.client_reference_id;
    subscriptionId = typeof s.subscription === "string" ? s.subscription : null;
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const s = event.data.object as Stripe.Subscription;
    subscriptionId = s.id;
    userId = (s.metadata?.user_id as string | undefined) ?? null;
  } else {
    return; // type non géré
  }

  if (!subscriptionId) return;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  // user_id : client_reference_id (checkout) sinon metadata.user_id ; à défaut, abandon (event orphelin).
  userId = userId ?? ((sub.metadata?.user_id as string | undefined) ?? null);
  if (!userId) return;

  // Stripe (SDK v22+, API récente) : current_period_end vit au niveau de l'item
  // (facturation par item), plus sur la subscription elle-même.
  const item = sub.items.data[0];
  const interval = item?.price.recurring?.interval ?? "month";
  const periodEndSeconds = item?.current_period_end ?? Math.floor(Date.now() / 1000);
  const admin = createAdminClient();
  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      tier: "premium",
      status: mapStripeStatus(sub.status),
      period: intervalToPeriod(interval),
      current_period_end: new Date(periodEndSeconds * 1000).toISOString(),
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
