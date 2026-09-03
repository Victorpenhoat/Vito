import { describe, expect, it } from "vitest";
import { classifyHebergement } from "./classifyHebergement";

describe("classifyHebergement", () => {
  it("classe les hôtels (hotel/motel/resort/lodging)", () => {
    expect(classifyHebergement(["lodging", "hotel"])).toBe("hotel");
    expect(classifyHebergement(["resort_hotel"])).toBe("hotel");
    expect(classifyHebergement(["motel", "lodging"])).toBe("hotel");
  });
  it("classe les chambres d'hôtes AVANT le lodging générique", () => {
    expect(classifyHebergement(["lodging", "bed_and_breakfast"])).toBe("chambre_hotes");
    expect(classifyHebergement(["guest_house", "lodging"])).toBe("chambre_hotes");
  });
  it("classe maisons et appartements", () => {
    expect(classifyHebergement(["cottage", "lodging"])).toBe("maison");
    expect(classifyHebergement(["villa"])).toBe("maison");
    expect(classifyHebergement(["apartment_rental", "lodging"])).toBe("appartement");
    expect(classifyHebergement(["extended_stay_hotel", "lodging"])).toBe("appartement");
  });
  it("retombe sur autre quand rien ne matche", () => {
    expect(classifyHebergement(["campground"])).toBe("autre");
    expect(classifyHebergement([])).toBe("autre");
  });
});
