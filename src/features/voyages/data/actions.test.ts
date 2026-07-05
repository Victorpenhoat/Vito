import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type OpResult } from "@/test/supabaseMock";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => mock.client }));

import { deleteVoyage, deleteReservation } from "./actions";

const V = "10000000-0000-4000-8000-000000000011";
const fd = (e: Array<[string, string]>) => { const f = new FormData(); e.forEach(([k, v]) => f.append(k, v)); return f; };
const setup = (o: Parameters<typeof createMockSupabase>[0]) => { mock = createMockSupabase(o); };
beforeEach(() => revalidatePath.mockClear());

describe("deleteVoyage — autorisation via maybeSingle", () => {
  it("0 ligne (RLS) → non autorisé, pas de revalidation", async () => {
    setup({ on: (): OpResult => ({ data: null, error: null }) });
    expect(await deleteVoyage(undefined, fd([["voyageId", V]]))).toEqual({ error: "Suppression non autorisée" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("ligne supprimée → ok + revalidation", async () => {
    setup({ on: (): OpResult => ({ data: { id: V }, error: null }) });
    expect(await deleteVoyage(undefined, fd([["voyageId", V]]))).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/voyages");
  });
  it("refuse sans authentification", async () => {
    setup({ user: null });
    expect(await deleteVoyage(undefined, fd([["voyageId", V]]))).toEqual({ error: "Non authentifié" });
  });
});

describe("deleteReservation — autorisation via maybeSingle", () => {
  it("0 ligne → non autorisé", async () => {
    setup({ on: (): OpResult => ({ data: null, error: null }) });
    expect(await deleteReservation(undefined, fd([["reservationId", V], ["voyageId", V]]))).toEqual({ error: "Suppression non autorisée" });
  });
});
