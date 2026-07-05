import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, tableInsert, type OpResult } from "@/test/supabaseMock";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => mock.client }));

import { addDegustation } from "./actions";

const fd = (e: Array<[string, string]>) => { const f = new FormData(); e.forEach(([k, v]) => f.append(k, v)); return f; };
const setup = (o: Parameters<typeof createMockSupabase>[0]) => { mock = createMockSupabase(o); };
beforeEach(() => revalidatePath.mockClear());

describe("addDegustation — find_or_create_vin puis insert degustation", () => {
  it("happy path : RPC vin + insert degustation reliée à l'utilisateur, revalide /vins", async () => {
    setup({ on: (t): OpResult => (t === "degustations" ? { error: null } : { data: null }), rpc: () => ({ data: "vin-1" }) });
    const res = await addDegustation(undefined, fd([["nom", "Chablis"], ["couleur", "blanc"], ["note", "4"]]));
    expect(res).toEqual({ ok: true });
    expect(mock.calls.find((c) => c.kind === "rpc")).toMatchObject({ name: "find_or_create_vin" });
    expect(tableInsert(mock.calls, "degustations")?.payload).toMatchObject({ user_id: "u1", vin_id: "vin-1", note: 4 });
    expect(revalidatePath).toHaveBeenCalledWith("/vins");
  });
  it("échec find_or_create_vin → message dédié, pas d'insert", async () => {
    setup({ rpc: () => ({ error: { message: "boom" } }) });
    expect(await addDegustation(undefined, fd([["nom", "X"], ["couleur", "rouge"]]))).toEqual({ error: "Enregistrement du vin échoué" });
    expect(tableInsert(mock.calls, "degustations")).toBeUndefined();
  });
  it("refuse sans authentification", async () => {
    setup({ user: null });
    expect(await addDegustation(undefined, fd([["nom", "X"], ["couleur", "rouge"]]))).toEqual({ error: "Non authentifié" });
  });
});
