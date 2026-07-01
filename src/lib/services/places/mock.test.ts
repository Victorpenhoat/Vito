import { describe, it, expect } from "vitest";
import { MockPlacesProvider } from "./mock";

describe("MockPlacesProvider", () => {
  it("recherche renvoie des résultats filtrés", async () => {
    const p = new MockPlacesProvider();
    const res = await p.search("bistrot");
    expect(res.length).toBeGreaterThan(0);
    expect(res[0]!.placeId).toBeTruthy();
  });
  it("details renvoie une fiche complète pour un placeId connu", async () => {
    const p = new MockPlacesProvider();
    const list = await p.search("bistrot");
    const d = await p.details(list[0]!.placeId);
    expect(d?.nom).toBeTruthy();
  });
  it("details renvoie null pour un placeId inconnu", async () => {
    const p = new MockPlacesProvider();
    expect(await p.details("placeId_inexistant")).toBeNull();
  });
  it("photoUrl renvoie une URL pour une réf non vide, null sinon", () => {
    const p = new MockPlacesProvider();
    expect(p.photoUrl("mock_photo_1", 400)).toBeTruthy();
    expect(p.photoUrl("", 400)).toBeNull();
  });
  it("photoUrl laisse passer une URL http / data (photos de seed en dev)", () => {
    const p = new MockPlacesProvider();
    const url = "https://images.unsplash.com/photo-123?w=800";
    expect(p.photoUrl(url, 400)).toBe(url);
    expect(p.photoUrl("data:image/png;base64,AAAA", 400)).toBe("data:image/png;base64,AAAA");
  });
  it("details renvoie un rating numérique 0-5 + ratingCount", async () => {
    const r = await new MockPlacesProvider().details("mock_bistrot_1");
    expect(r).not.toBeNull();
    expect(typeof r!.rating).toBe("number");
    expect(r!.rating).toBeGreaterThanOrEqual(0);
    expect(r!.rating).toBeLessThanOrEqual(5);
    expect(typeof r!.ratingCount).toBe("number");
  });
});
