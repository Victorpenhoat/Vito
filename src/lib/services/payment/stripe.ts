import Stripe from "stripe";
import { env } from "@/lib/env";
import type { PaymentProvider, CheckoutPlan, CheckoutResult } from "./types";

// Adaptateur Stripe réel. Checkout hébergé (redirect) + Billing Portal.
// Le statut premium est ensuite synchronisé par le webhook (jamais ici).
export class StripePaymentProvider implements PaymentProvider {
  constructor(private readonly stripe: Stripe) {}

  async checkout(plan: CheckoutPlan): Promise<CheckoutResult> {
    const price = plan.period === "monthly" ? env.STRIPE_PRICE_MONTHLY! : env.STRIPE_PRICE_YEARLY!;
    const base = env.NEXT_PUBLIC_APP_URL!;
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: plan.userId,
      // Stripe ne copie PAS client_reference_id sur la Subscription créée : sans ceci,
      // subscription.metadata est vide côté webhook (customer.subscription.updated/.deleted
      // n'ont plus aucun moyen de retrouver le user_id).
      subscription_data: { metadata: { user_id: plan.userId } },
      ...(plan.customerId ? { customer: plan.customerId } : { customer_email: plan.email }),
      success_url: `${base}/abonnement?checkout=success`,
      cancel_url: `${base}/abonnement?checkout=cancel`,
    });
    return { mode: "redirect", url: session.url! };
  }

  async portalUrl(customerId: string): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.NEXT_PUBLIC_APP_URL!}/abonnement`,
    });
    return session.url;
  }
}
