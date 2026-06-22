import type { PaymentProvider, CheckoutPlan, CheckoutResult } from "./types";

// Mock-first : « paie » immédiatement. L'activation premium réelle se fait via la RPC mock_subscribe.
export class MockPaymentProvider implements PaymentProvider {
  async checkout(_plan: CheckoutPlan): Promise<CheckoutResult> {
    return { mode: "activated" };
  }
}
