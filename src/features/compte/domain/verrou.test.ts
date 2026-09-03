import { describe, expect, it } from "vitest";
import { doitVerrouiller, preferencesVerrouSchema } from "./schemas";

describe("doitVerrouiller", () => {
  it("verrouille immédiatement quand le délai est nul", () => {
    expect(doitVerrouiller(0, 0)).toBe(true);
    expect(doitVerrouiller(0, 10_000)).toBe(true);
  });
  it("attend le délai avant de verrouiller", () => {
    expect(doitVerrouiller(5, 4 * 60_000)).toBe(false);
    expect(doitVerrouiller(5, 5 * 60_000)).toBe(true);
    expect(doitVerrouiller(15, 16 * 60_000)).toBe(true);
  });
});

describe("preferencesVerrouSchema", () => {
  it("n'accepte que les délais proposés", () => {
    expect(preferencesVerrouSchema.safeParse({ delaiMinutes: "5" }).success).toBe(true);
    expect(preferencesVerrouSchema.safeParse({ delaiMinutes: 0 }).success).toBe(true);
    expect(preferencesVerrouSchema.safeParse({ delaiMinutes: 7 }).success).toBe(false);
  });
});
