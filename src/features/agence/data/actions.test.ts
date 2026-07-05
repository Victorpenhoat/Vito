import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test/supabaseMock";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => mock.client }));

import { lierClient, delierClient } from "./actions";

const fd = (e: Array<[string, string]>) => { const f = new FormData(); e.forEach(([k, v]) => f.append(k, v)); return f; };
const setup = (o: Parameters<typeof createMockSupabase>[0]) => { mock = createMockSupabase(o); };
beforeEach(() => revalidatePath.mockClear());

describe("lierClient — réponses du RPC lier_client", () => {
  it('ok → appelle lier_client avec l\'email et revalide', async () => {
    setup({ rpc: () => ({ data: "ok" }) });
    const res = await lierClient(undefined, fd([["email", "client@vito.test"]]));
    expect(res).toEqual({ ok: true });
    expect(mock.calls.find((c) => c.kind === "rpc")).toMatchObject({ name: "lier_client", args: { p_email: "client@vito.test" } });
    expect(revalidatePath).toHaveBeenCalledWith("/agence");
  });
  it('not_found → message dédié, pas de revalidation', async () => {
    setup({ rpc: () => ({ data: "not_found" }) });
    expect(await lierClient(undefined, fd([["email", "x@vito.test"]]))).toEqual({ error: "Aucun utilisateur avec cet e-mail" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it('self → message dédié', async () => {
    setup({ rpc: () => ({ data: "self" }) });
    expect(await lierClient(undefined, fd([["email", "x@vito.test"]]))).toEqual({ error: "Vous ne pouvez pas vous lier vous-même" });
  });
  it("erreur RPC → message générique (loggé)", async () => {
    setup({ rpc: () => ({ error: { message: "boom" } }) });
    expect(await lierClient(undefined, fd([["email", "x@vito.test"]]))).toEqual({ error: "Liaison échouée" });
  });
  it("refuse sans authentification", async () => {
    setup({ user: null });
    expect(await lierClient(undefined, fd([["email", "x@vito.test"]]))).toEqual({ error: "Non authentifié" });
  });
});

describe("delierClient", () => {
  it("appelle delier_client et revalide", async () => {
    setup({ rpc: () => ({ error: null }) });
    expect(await delierClient(undefined, fd([["clientId", "c1"]]))).toEqual({ ok: true });
    expect(mock.calls.find((c) => c.kind === "rpc")).toMatchObject({ name: "delier_client", args: { p_client_id: "c1" } });
  });
});
