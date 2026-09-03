import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, tableInsert, type OpResult } from "@/test/supabaseMock";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => mock.client }));

import { enregistrerDegustation } from "./actions";

const VIN = "11111111-1111-4111-8111-111111111111";
const ETAB = "22222222-2222-4222-8222-222222222222";
const fd = (e: Array<[string, string]>) => { const f = new FormData(); e.forEach(([k, v]) => f.append(k, v)); return f; };
const setup = (o: Parameters<typeof createMockSupabase>[0]) => { mock = createMockSupabase(o); };
beforeEach(() => revalidatePath.mockClear());

describe("enregistrerDegustation", () => {
  it("enregistre ce que j'ai vécu : note en verres, prix avec son unité, envie de le retrouver", async () => {
    setup({ on: (t): OpResult => (t === "degustations" ? { data: { id: "deg-1" } } : { data: null }) });
    const res = await enregistrerDegustation(undefined, fd([
      ["vinId", VIN], ["note", "4.3"], ["prixPaye", "46"], ["prixUnite", "bouteille"],
      ["lieuType", "maison"], ["aRacheter", "on"],
    ]));
    expect(res).toMatchObject({ ok: true });
    expect(tableInsert(mock.calls, "degustations")?.payload).toMatchObject({
      user_id: "u1", vin_id: VIN, note: 4.5, prix_paye: 46, prix_unite: "bouteille",
      lieu_type: "maison", a_racheter: true,
    });
  });

  it("un restaurant identifie le lieu : le lieu libre n'est pas enregistré par-dessus", async () => {
    setup({ on: (t): OpResult => (t === "degustations" ? { data: { id: "deg-1" } } : { data: null }) });
    await enregistrerDegustation(undefined, fd([
      ["vinId", VIN], ["etablissementId", ETAB], ["lieuType", "maison"], ["lieuNom", "Chez moi"],
    ]));
    expect(tableInsert(mock.calls, "degustations")?.payload).toMatchObject({
      etablissement_id: ETAB, lieu_type: "restaurant", lieu_nom: null,
    });
  });

  it("une dégustation sans visite reste possible : rien n'exige un visite_id", async () => {
    setup({ on: (t): OpResult => (t === "degustations" ? { data: { id: "deg-1" } } : { data: null }) });
    await enregistrerDegustation(undefined, fd([["vinId", VIN], ["etablissementId", ETAB]]));
    expect(tableInsert(mock.calls, "degustations")?.payload).toMatchObject({ visite_id: null });
  });

  it("saisie invalide → refus net, aucun insert", async () => {
    setup({});
    expect(await enregistrerDegustation(undefined, fd([["vinId", "pas-un-uuid"]]))).toEqual({ error: "Saisie invalide" });
    expect(tableInsert(mock.calls, "degustations")).toBeUndefined();
  });

  it("refuse sans authentification", async () => {
    setup({ user: null });
    expect(await enregistrerDegustation(undefined, fd([["vinId", VIN]]))).toEqual({ error: "Non authentifié" });
  });
});
