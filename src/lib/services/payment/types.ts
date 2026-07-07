export type CheckoutPlan = {
  period: "monthly" | "yearly";
  userId: string;
  email: string;
  customerId?: string; // stripe_customer_id si déjà connu
};
export type CheckoutResult = { mode: "activated" } | { mode: "redirect"; url: string };

export interface PaymentProvider {
  checkout(plan: CheckoutPlan): Promise<CheckoutResult>;
  portalUrl(customerId: string): Promise<string>;
}
