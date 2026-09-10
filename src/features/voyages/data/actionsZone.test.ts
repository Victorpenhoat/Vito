import { describe, it, expect, vi, beforeEach } from "vitest";

// "server-only" throw inconditionnellement hors bundler Next (pas de condition
// d'export "react-server" sous Vitest) — no-op pour ce test unitaire de l'action.
vi.mock("server-only", () => ({}));

const update = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser },
    from: () => ({ update: (v: unknown) => { update(v); return { eq: async () => ({ error: null }) }; } }),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { enregistrerZoneScolaire } from "./actionsZone";

const formulaire = (zone: string) => {
  const f = new FormData();
  f.set("zone", zone);
  return f;
};

beforeEach(() => {
  update.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
});

describe("enregistrerZoneScolaire", () => {
  it("enregistre une zone du vocabulaire de la source", async () => {
    expect(await enregistrerZoneScolaire(undefined, formulaire("Zone C"))).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ zone_scolaire: "Zone C" });
  });

  it("accepte les territoires, pas seulement A/B/C", async () => {
    await enregistrerZoneScolaire(undefined, formulaire("Réunion"));
    expect(update).toHaveBeenCalledWith({ zone_scolaire: "Réunion" });
  });

  // Une valeur libre viendrait d'un formulaire trafiqué : elle salirait la
  // colonne et ne correspondrait à aucune ligne du calendrier.
  it("refuse une zone hors vocabulaire, sans écrire", async () => {
    const r = await enregistrerZoneScolaire(undefined, formulaire("Zone Z"));
    expect(r).toHaveProperty("error");
    expect(update).not.toHaveBeenCalled();
  });

  it("refuse sans session, sans écrire", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const r = await enregistrerZoneScolaire(undefined, formulaire("Zone C"));
    expect(r).toHaveProperty("error");
    expect(update).not.toHaveBeenCalled();
  });
});
