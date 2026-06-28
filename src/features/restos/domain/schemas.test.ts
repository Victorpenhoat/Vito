import { describe, it, expect } from "vitest";
import { toggleFavoriteSchema, addAvisSchema, toggleArchiveSchema } from "./schemas";

// UUID v4 valide (Zod v4 .uuid() vérifie le nibble de version/variant ;
// les vrais ids viennent de gen_random_uuid() => v4 valide).
const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("toggleFavoriteSchema", () => {
  it('parse la string "false" -> false (et non true comme le ferait Boolean)', () => {
    const r = toggleFavoriteSchema.parse({ listeItemId: UUID, isFavorite: "false" });
    expect(r.isFavorite).toBe(false);
  });
  it('parse la string "true" -> true', () => {
    const r = toggleFavoriteSchema.parse({ listeItemId: UUID, isFavorite: "true" });
    expect(r.isFavorite).toBe(true);
  });
});

describe("addAvisSchema", () => {
  it("accepte un avis sans note (commentaire libre)", () => {
    const r = addAvisSchema.safeParse({ etablissementId: UUID, commentaire: "super" });
    expect(r.success).toBe(true);
  });
  it("rejette une note hors plage (6)", () => {
    const r = addAvisSchema.safeParse({ etablissementId: UUID, note: 6 });
    expect(r.success).toBe(false);
  });
});

describe("toggleArchiveSchema", () => {
  it('parse "true" -> true', () => {
    expect(toggleArchiveSchema.parse({ listeItemId: UUID, isArchived: "true" }).isArchived).toBe(true);
  });
  it('parse "false" -> false', () => {
    expect(toggleArchiveSchema.parse({ listeItemId: UUID, isArchived: "false" }).isArchived).toBe(false);
  });
  it("rejette un listeItemId non-uuid", () => {
    expect(toggleArchiveSchema.safeParse({ listeItemId: "x", isArchived: "true" }).success).toBe(false);
  });
});
