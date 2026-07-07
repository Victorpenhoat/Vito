import Stripe from "stripe";
import { env } from "@/lib/env";
import { MockPaymentProvider } from "./mock";
import { StripePaymentProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  // Bascule mock/réel : sans clé Stripe (local/CI/e2e) on reste sur le mock.
  if (env.STRIPE_SECRET_KEY) {
    return new StripePaymentProvider(new Stripe(env.STRIPE_SECRET_KEY));
  }
  return new MockPaymentProvider();
}

export type { PaymentProvider, CheckoutPlan, CheckoutResult } from "./types";
