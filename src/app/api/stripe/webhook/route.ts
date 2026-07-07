import Stripe from "stripe";
import { env } from "@/lib/env";
import { logActionError } from "@/lib/actionError";
import { syncSubscriptionFromEvent } from "@/features/abonnement/data/syncStripe";

// Corps brut requis pour la vérif de signature → runtime nodejs (pas edge).
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY!);
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET!);
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
