import { describe, it, expect } from "vitest";
import { goutsInputSchema, rechercheCriteriaSchema } from "./schemas";

describe("goutsInputSchema", () => {
  it("accepte des goûts vides (tout par défaut)", () => {
    const r = goutsInputSchema.parse({});
    expect(r.ambiances).toEqual([]);
    expect(r.typesPreferes).toEqual([]);
    expect(r.zones).toEqual([]);
  });
  it("coerce budgetMax et rejette négatif", () => {
    expect(goutsInputSchema.parse({ budgetMax: "50" }).budgetMax).toBe(50);
    expect(goutsInputSchema.safeParse({ budgetMax: -1 }).success).toBe(false);
  });
});

describe("rechercheCriteriaSchema", () => {
  it("tout optionnel", () => {
    expect(rechercheCriteriaSchema.safeParse({}).success).toBe(true);
  });
  it("coerce budgetMax", () => {
    expect(rechercheCriteriaSchema.parse({ budgetMax: "40" }).budgetMax).toBe(40);
  });
});
