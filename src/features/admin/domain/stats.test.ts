import { describe, it, expect } from "vitest";
import { computeAdminStats } from "./stats";

const now = new Date("2026-06-22T00:00:00Z");

describe("computeAdminStats", () => {
  it("compte users, premium (via isPremiumFrom) et demandes par statut", () => {
    const stats = computeAdminStats(
      {
        users: [{ id: "a" }, { id: "b" }, { id: "c" }],
        subscriptions: [
          { status: "active", currentPeriodEnd: "2026-01-01" }, // premium (actif, même si date passée)
          { status: "canceled", currentPeriodEnd: "2026-12-31" }, // premium (annulé, non expiré)
          { status: "canceled", currentPeriodEnd: "2026-01-01" }, // PAS premium (annulé, expiré)
        ],
        demandes: [{ statut: "nouvelle" }, { statut: "nouvelle" }, { statut: "confirmee" }],
      },
      now,
    );
    expect(stats.totalUsers).toBe(3);
    expect(stats.premiumActifs).toBe(2);
    expect(stats.demandesParStatut).toEqual({ nouvelle: 2, confirmee: 1 });
  });
});
