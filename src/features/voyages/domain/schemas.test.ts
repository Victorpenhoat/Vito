import { describe, it, expect } from "vitest";
import { voyageInputSchema, reservationInputSchema, shareInputSchema } from "./schemas";

const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("voyageInputSchema", () => {
  it("titre requis", () => {
    expect(voyageInputSchema.safeParse({}).success).toBe(false);
    expect(voyageInputSchema.safeParse({ titre: "Rome" }).success).toBe(true);
  });
  it("rejette dateFin < dateDebut", () => {
    expect(voyageInputSchema.safeParse({ titre: "X", dateDebut: "2026-09-10", dateFin: "2026-09-01" }).success).toBe(false);
  });
  it("rejette un statut invalide", () => {
    expect(voyageInputSchema.safeParse({ titre: "X", statut: "annule" }).success).toBe(false);
  });
});

describe("reservationInputSchema", () => {
  it("voyageId uuid requis + type valide", () => {
    expect(reservationInputSchema.safeParse({ voyageId: UUID, type: "hotel" }).success).toBe(true);
    expect(reservationInputSchema.safeParse({ voyageId: "x", type: "hotel" }).success).toBe(false);
    expect(reservationInputSchema.safeParse({ voyageId: UUID, type: "train" }).success).toBe(false);
  });
  it("rejette un mail conciergerie invalide et un lien non-url", () => {
    expect(reservationInputSchema.safeParse({ voyageId: UUID, type: "hotel", conciergerieMail: "nope" }).success).toBe(false);
    expect(reservationInputSchema.safeParse({ voyageId: UUID, type: "hotel", lien: "nope" }).success).toBe(false);
  });
});

describe("shareInputSchema", () => {
  it("email valide requis", () => {
    expect(shareInputSchema.safeParse({ voyageId: UUID, email: "a@b.fr" }).success).toBe(true);
    expect(shareInputSchema.safeParse({ voyageId: UUID, email: "nope" }).success).toBe(false);
  });
});
