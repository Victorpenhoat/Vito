import { describe, it, expect } from "vitest";
import { MockPaymentProvider } from "./mock";

describe("MockPaymentProvider", () => {
  it("checkout active immédiatement (mode activated)", async () => {
    const r = await new MockPaymentProvider().checkout({
      period: "monthly",
      userId: "user_123",
      email: "test@example.com",
    });
    expect(r).toEqual({ mode: "activated" });
  });

  it("portalUrl renvoie une URL de repli locale (mode mock)", async () => {
    const r = await new MockPaymentProvider().portalUrl("cus_mock");
    expect(r).toBe("/abonnement");
  });
});
