import { describe, it, expect } from "vitest";
import { demandeRestoSchema, demandeHotelSchema, reponseSchema } from "./schemas";

const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("demandeRestoSchema", () => {
  it("accepte une demande resto valide", () => {
    expect(demandeRestoSchema.safeParse({
      etablissementId: UUID, dateResa: "2026-09-12", heureResa: "20:30",
      nombreConvives: "4", occasion: "famille", avecEnfants: true, nbEnfants: "2", chaiseHaute: true,
    }).success).toBe(true);
  });
  it("rejette convives <= 0 et occasion invalide", () => {
    expect(demandeRestoSchema.safeParse({ etablissementId: UUID, dateResa: "2026-09-12", heureResa: "20:30", nombreConvives: "0", occasion: "famille" }).success).toBe(false);
    expect(demandeRestoSchema.safeParse({ etablissementId: UUID, dateResa: "2026-09-12", heureResa: "20:30", nombreConvives: "2", occasion: "boulot" }).success).toBe(false);
  });
});

describe("demandeHotelSchema", () => {
  it("accepte une demande hôtel valide", () => {
    expect(demandeHotelSchema.safeParse({ placeId: "mock_hotel_1", dateDebut: "2026-09-12", nombreNuits: "3", sejourType: "loisirs" }).success).toBe(true);
  });
  it("rejette nuits <= 0 et sejourType invalide", () => {
    expect(demandeHotelSchema.safeParse({ placeId: "x", dateDebut: "2026-09-12", nombreNuits: "0", sejourType: "loisirs" }).success).toBe(false);
    expect(demandeHotelSchema.safeParse({ placeId: "x", dateDebut: "2026-09-12", nombreNuits: "3", sejourType: "vacances" }).success).toBe(false);
  });
});

describe("reponseSchema", () => {
  it("statut valide requis", () => {
    expect(reponseSchema.safeParse({ demandeId: UUID, statut: "confirmee", reponse: "ok" }).success).toBe(true);
    expect(reponseSchema.safeParse({ demandeId: UUID, statut: "annulee" }).success).toBe(false);
  });
});
