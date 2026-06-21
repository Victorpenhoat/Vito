import { describe, it, expect } from "vitest";
import { filtersToQuery } from "./filtersToQuery";

describe("filtersToQuery", () => {
  it("vins-level vs degustation-level séparés", () => {
    const q = filtersToQuery({ couleur: "rouge", region: "Bordeaux", noteMin: 3, etablissementId: undefined, dateFrom: "2026-01-01", dateTo: undefined });
    expect(q.vin.couleur).toBe("rouge");
    expect(q.vin.region).toBe("Bordeaux");
    expect(q.degustation.noteMin).toBe(3);
    expect(q.degustation.dateFrom).toBe("2026-01-01");
  });
  it("filtres absents -> contraintes vides", () => {
    const q = filtersToQuery({});
    expect(q.vin.couleur).toBeUndefined();
    expect(q.degustation.noteMin).toBeUndefined();
  });
});
