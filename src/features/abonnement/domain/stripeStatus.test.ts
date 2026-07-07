import { describe, it, expect } from "vitest";
import { mapStripeStatus, intervalToPeriod } from "./stripeStatus";

describe("mapStripeStatus", () => {
  it.each(["active", "trialing", "past_due"])("%s → active", (s) => {
    expect(mapStripeStatus(s)).toBe("active");
  });
  it.each(["canceled", "unpaid", "incomplete_expired"])("%s → canceled", (s) => {
    expect(mapStripeStatus(s)).toBe("canceled");
  });
});

describe("intervalToPeriod", () => {
  it("month → monthly", () => expect(intervalToPeriod("month")).toBe("monthly"));
  it("year → yearly", () => expect(intervalToPeriod("year")).toBe("yearly"));
});
