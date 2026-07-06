import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type OpResult } from "@/test/supabaseMock";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => mock.client }));

import { repondreDemande, supprimerDemande } from "./actions";

const DEM = "10000000-0000-4000-8000-000000000d01";
const fd = (e: Array<[string, string]>) => { const f = new FormData(); e.forEach(([k, v]) => f.append(k, v)); return f; };
const setup = (o: Parameters<typeof createMockSupabase>[0]) => { mock = createMockSupabase(o); };
beforeEach(() => revalidatePath.mockClear());

describe("repondreDemande — réservé au concierge (maybeSingle)", () => {
  it("0 ligne (non concierge / RLS) → refus, pas de revalidation", async () => {
    setup({ on: (): OpResult => ({ data: null, error: null }) });
    expect(await repondreDemande(undefined, fd([["demandeId", DEM], ["statut", "confirmee"]]))).toEqual({ error: "Action réservée au concierge" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("ligne mise à jour → ok", async () => {
    setup({ on: (): OpResult => ({ data: { id: DEM }, error: null }) });
    expect(await repondreDemande(undefined, fd([["demandeId", DEM], ["statut", "confirmee"]]))).toEqual({ ok: true });
  });
});

describe("supprimerDemande — autorisation via maybeSingle", () => {
  it("0 ligne → non autorisé", async () => {
    setup({ on: (): OpResult => ({ data: null, error: null }) });
    expect(await supprimerDemande(undefined, fd([["demandeId", "d1"]]))).toEqual({ error: "Suppression non autorisée" });
  });
});
