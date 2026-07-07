import { describe, it, expect } from "vitest";
import { z } from "zod";

// Reproduit le schéma + refine de src/lib/env.ts pour tester la règle de cohérence
// sans muter process.env global. La forme testée DOIT rester identique à env.ts.
function buildSchema() {
  return z
    .object({
      NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
      STRIPE_SECRET_KEY: z.string().optional(),
      STRIPE_WEBHOOK_SECRET: z.string().optional(),
      STRIPE_PRICE_MONTHLY: z.string().optional(),
      STRIPE_PRICE_YEARLY: z.string().optional(),
      NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    })
    .refine((v) => !v.STRIPE_SECRET_KEY || (v.STRIPE_WEBHOOK_SECRET && v.STRIPE_PRICE_MONTHLY && v.STRIPE_PRICE_YEARLY && v.NEXT_PUBLIC_APP_URL && v.SUPABASE_SERVICE_ROLE_KEY), {
      message: "STRIPE_SECRET_KEY présent : STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, NEXT_PUBLIC_APP_URL et SUPABASE_SERVICE_ROLE_KEY sont requis",
    });
}

const base = { NEXT_PUBLIC_SUPABASE_URL: "http://x.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" };

describe("env refine Stripe", () => {
  it("mock-first : sans clé Stripe, valide", () => {
    expect(buildSchema().safeParse(base).success).toBe(true);
  });
  it("clé Stripe sans compléments → invalide", () => {
    expect(buildSchema().safeParse({ ...base, STRIPE_SECRET_KEY: "sk" }).success).toBe(false);
  });
  it("clé Stripe avec tous les compléments → valide", () => {
    const r = buildSchema().safeParse({
      ...base, STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh",
      STRIPE_PRICE_MONTHLY: "pm", STRIPE_PRICE_YEARLY: "py",
      NEXT_PUBLIC_APP_URL: "https://a.co", SUPABASE_SERVICE_ROLE_KEY: "srv",
    });
    expect(r.success).toBe(true);
  });
});
