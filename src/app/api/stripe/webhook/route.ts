import type Stripe from "stripe";
import { env } from "@/lib/env";
import { logActionError } from "@/lib/actionError";
import { createStripe } from "@/lib/services/payment/stripeClient";
import { syncSubscriptionFromEvent } from "@/features/abonnement/data/syncStripe";

// Corps brut requis pour la vérif de signature → runtime nodejs (pas edge).
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    logActionError("stripe.webhook.misconfigured", new Error("Stripe non configuré"));
    return new Response("configuration Stripe manquante", { status: 500 });
  }

  const stripe = createStripe(env.STRIPE_SECRET_KEY);
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logActionError("stripe.webhook.signature", err);
    return new Response("signature invalide", { status: 400 });
  }

  try {
    await syncSubscriptionFromEvent(event, stripe);
  } catch (err) {
    logActionError("stripe.webhook.sync", err);
    return new Response("erreur de synchro", { status: 500 }); // Stripe rejouera
  }
  return new Response(null, { status: 200 });
}
