import { describe, it, expect, vi } from "vitest";
import { StripePaymentProvider } from "./stripe";

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_PRICE_MONTHLY: "price_m",
    STRIPE_PRICE_YEARLY: "price_y",
    NEXT_PUBLIC_APP_URL: "https://vito.test",
  },
}));

function fakeStripe() {
  return {
    checkout: { sessions: { create: vi.fn(async () => ({ url: "https://checkout.stripe/x" })) } },
    billingPortal: { sessions: { create: vi.fn(async () => ({ url: "https://portal.stripe/y" })) } },
  };
}

describe("StripePaymentProvider", () => {
  it("checkout crée une session subscription et renvoie l'URL de redirect", async () => {
    const s = fakeStripe();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = new StripePaymentProvider(s as any);
    const r = await p.checkout({ period: "monthly", userId: "u1", email: "a@b.c" });
    expect(r).toEqual({ mode: "redirect", url: "https://checkout.stripe/x" });
    expect(s.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        client_reference_id: "u1",
        customer_email: "a@b.c",
        line_items: [{ price: "price_m", quantity: 1 }],
        success_url: expect.stringContaining("https://vito.test"),
      })
    );
  });

  it("checkout utilise le price annuel et customer existant", async () => {
    const s = fakeStripe();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = new StripePaymentProvider(s as any);
    await p.checkout({ period: "yearly", userId: "u1", email: "a@b.c", customerId: "cus_1" });
    expect(s.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_y", quantity: 1 }],
        customer: "cus_1",
      })
    );
  });

  it("portalUrl crée une session de portail et renvoie l'URL", async () => {
    const s = fakeStripe();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = new StripePaymentProvider(s as any);
    const url = await p.portalUrl("cus_1");
    expect(url).toBe("https://portal.stripe/y");
    expect(s.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1" })
    );
  });
});
