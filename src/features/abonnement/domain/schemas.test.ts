import { describe, it, expect } from "vitest";
import { subscribeSchema } from "./schemas";

describe("subscribeSchema", () => {
  it("accepte monthly et yearly", () => {
    expect(subscribeSchema.safeParse({ period: "monthly" }).success).toBe(true);
    expect(subscribeSchema.safeParse({ period: "yearly" }).success).toBe(true);
  });
  it("rejette une période invalide", () => {
    expect(subscribeSchema.safeParse({ period: "weekly" }).success).toBe(false);
  });
});
