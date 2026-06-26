import { describe, it, expect } from "vitest";
import { splitVoyages } from "./splitVoyages";

const v = (id: string, statut: string, date_debut: string | null) => ({ id, statut, date_debut });

describe("splitVoyages", () => {
  it("isole le prochain départ à venir (statut planifié/confirmé, date >= today)", () => {
    const r = splitVoyages([v("a", "termine", "2020-01-01"), v("b", "confirme", "2026-09-12")], "2026-06-26");
    expect(r.prochain?.id).toBe("b");
    expect(r.reste.map((x) => x.id)).toEqual(["a"]);
  });
  it("aucun à venir → prochain=null, reste=tout", () => {
    const r = splitVoyages([v("a", "termine", "2020-01-01"), v("c", "planifie", "2026-01-01")], "2026-06-26");
    expect(r.prochain).toBeNull();
    expect(r.reste.map((x) => x.id)).toEqual(["a", "c"]);
  });
  it("en_cours n'est pas un « prochain départ »", () => {
    const r = splitVoyages([v("d", "en_cours", "2026-09-01")], "2026-06-26");
    expect(r.prochain).toBeNull();
  });
});
