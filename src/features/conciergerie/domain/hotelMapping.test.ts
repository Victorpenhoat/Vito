import { describe, it, expect } from "vitest";
import { MockPlacesProvider } from "@/lib/services/places/mock";
import { mapPlaceToEtablissement } from "@/features/restos/domain/mapPlaceToEtablissement";

describe("recherche d'hôtels (mock Places)", () => {
  it("la recherche 'hotel' renvoie des hôtels de démo", async () => {
    const res = await new MockPlacesProvider().search("hotel");
    expect(res.length).toBeGreaterThanOrEqual(2);
  });
});

describe("mapPlaceToEtablissement avec catégorie", () => {
  it("catégorie hotel force categorie/type = hotel", async () => {
    const place = await new MockPlacesProvider().details("mock_hotel_1");
    expect(place).not.toBeNull();
    const m = mapPlaceToEtablissement(place!, "hotel");
    expect(m.categorie).toBe("hotel");
    expect(m.type).toBe("hotel");
  });
  it("défaut = resto (compat existant)", async () => {
    const place = await new MockPlacesProvider().details("mock_bistrot_1");
    const m = mapPlaceToEtablissement(place!);
    expect(m.categorie).toBe("resto");
  });
});
