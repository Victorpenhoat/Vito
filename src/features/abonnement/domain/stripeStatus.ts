// Mapping Stripe → enum subscriptions ('active'|'canceled'). past_due reste premium
// le temps que Stripe relance (dunning géré côté Stripe).
export function mapStripeStatus(s: string): "active" | "canceled" {
  return s === "active" || s === "trialing" || s === "past_due" ? "active" : "canceled";
}

export function intervalToPeriod(i: string): "monthly" | "yearly" {
  return i === "year" ? "yearly" : "monthly";
}
