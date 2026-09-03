import { describe, expect, it } from "vitest";
import { creerTagSchema, updateTagSchema, fusionnerTagsSchema } from "./schemas";

describe("creerTagSchema", () => {
  it("label 1..60, scope borné, couleur hex optionnelle", () => {
    expect(creerTagSchema.safeParse({ label: "Date night", scope: "restaurant", color: "#A65D57" }).success).toBe(true);
    expect(creerTagSchema.safeParse({ label: "Sans couleur", scope: "common", color: "" }).success).toBe(true);
    expect(creerTagSchema.safeParse({ label: "", scope: "restaurant" }).success).toBe(false);
    expect(creerTagSchema.safeParse({ label: "x".repeat(61), scope: "restaurant" }).success).toBe(false);
    expect(creerTagSchema.safeParse({ label: "ok", scope: "vin" }).success).toBe(true);
    expect(creerTagSchema.safeParse({ label: "ok", scope: "voyage" }).success).toBe(false);
    expect(creerTagSchema.safeParse({ label: "ok", scope: "hotel", color: "rouge" }).success).toBe(false);
  });
});

describe("updateTagSchema / fusionnerTagsSchema", () => {
  it("uuids requis", () => {
    expect(updateTagSchema.safeParse({ tagId: "nope", label: "x", scope: "common" }).success).toBe(false);
    expect(fusionnerTagsSchema.safeParse({ sourceId: crypto.randomUUID(), cibleId: crypto.randomUUID() }).success).toBe(true);
    expect(fusionnerTagsSchema.safeParse({ sourceId: "a", cibleId: "b" }).success).toBe(false);
  });
});
