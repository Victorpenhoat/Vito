import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  // Mock-first : l'adaptateur Stripe réel (Checkout + webhooks, gaté par env.STRIPE_SECRET_KEY)
  // est différé. On renvoie toujours le mock pour ce slice.
  return new MockPaymentProvider();
}

export type { PaymentProvider, CheckoutPlan, CheckoutResult } from "./types";
