export type CheckoutPlan = { period: "monthly" | "yearly" };
export type CheckoutResult = { mode: "activated" } | { mode: "redirect"; url: string };

export interface PaymentProvider {
  checkout(plan: CheckoutPlan): Promise<CheckoutResult>;
}
