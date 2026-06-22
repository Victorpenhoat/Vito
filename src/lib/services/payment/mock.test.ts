import { describe, it, expect } from "vitest";
import { MockPaymentProvider } from "./mock";

describe("MockPaymentProvider", () => {
  it("checkout active immédiatement (mode activated)", async () => {
    const r = await new MockPaymentProvider().checkout({ period: "monthly" });
    expect(r).toEqual({ mode: "activated" });
  });
});
