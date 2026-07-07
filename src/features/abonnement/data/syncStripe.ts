import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";
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

  if (!subscriptionId) {
    log.warn("stripe.sync.no_subscription_id", { eventType: event.type });
    return;
  }
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const admin = createAdminClient();
  // user_id : client_reference_id (checkout) sinon metadata.user_id (checkout crée la sub
  // avec subscription_data.metadata.user_id) sinon, en dernier recours, la ligne existante
  // retrouvée par customer (renouvellement/annulation d'une sub créée avant ce fix, ou
  // metadata perdue côté Stripe).
  userId = userId ?? ((sub.metadata?.user_id as string | undefined) ?? null);
  if (!userId) {
    const { data, error } = await admin.from("subscriptions").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
    // Erreur DB (≠ "aucune ligne") : on throw pour que le webhook renvoie 500 et que
    // Stripe rejoue — sinon un event récupérable serait abandonné silencieusement.
    if (error) throw new Error(`lookup subscriptions par customer échoué: ${error.message}`);
    userId = data?.user_id ?? null;
  }
  if (!userId) {
    log.warn("stripe.sync.unresolved_user_id", { eventType: event.type, subscriptionId, customerId });
    return;
  }

  // Stripe (SDK v22+, API récente) : current_period_end vit au niveau de l'item
  // (facturation par item), plus sur la subscription elle-même.
  const item = sub.items.data[0];
  const interval = item?.price.recurring?.interval ?? "month";
  const periodEndSeconds = item?.current_period_end ?? Math.floor(Date.now() / 1000);
  // Annulation via le Billing Portal : Stripe garde status="active" mais pose
  // cancel_at_period_end=true jusqu'à la fin de période. On mappe alors sur "canceled"
  // (= « ne se renouvelle pas ») pour que l'UI affiche « premium jusqu'au {date} » et non
  // « renouvellement ». isPremiumFrom garde l'accès jusqu'à current_period_end. Une reprise
  // (cancel_at_period_end repassé à false) revient à "active" à l'event suivant.
  const status = sub.cancel_at_period_end ? "canceled" : mapStripeStatus(sub.status);
  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      tier: "premium",
      status,
      period: intervalToPeriod(interval),
      current_period_end: new Date(periodEndSeconds * 1000).toISOString(),
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
