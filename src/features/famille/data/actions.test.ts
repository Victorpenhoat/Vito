import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type OpResult } from "@/test/supabaseMock";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => mock.client }));

import { inviterMembre } from "./actions";

const fd = (e: Array<[string, string]>) => { const f = new FormData(); e.forEach(([k, v]) => f.append(k, v)); return f; };
// maFamilleId lit familles ; on renvoie un foyer pour atteindre le RPC.
const withFamille = (rpc: (n: string, a: unknown) => OpResult, user?: { id: string } | null) =>
  createMockSupabase({ user, on: (t) => (t === "familles" ? { data: { id: "fam1", owner_id: "u1" } } : { data: null }), rpc });
beforeEach(() => revalidatePath.mockClear());

describe("inviterMembre — réponses du RPC inviter_famille", () => {
  it("ok → invite et revalide /famille", async () => {
    mock = withFamille(() => ({ data: "ok" }));
    expect(await inviterMembre(undefined, fd([["email", "x@vito.test"]]))).toEqual({ ok: true });
    expect(mock.calls.find((c) => c.kind === "rpc")).toMatchObject({ name: "inviter_famille", args: { p_famille_id: "fam1", p_email: "x@vito.test" } });
    expect(revalidatePath).toHaveBeenCalledWith("/famille");
  });
  it("not_found / self / deja_famille → messages dédiés, pas de revalidation", async () => {
    for (const [data, msg] of [["not_found", "Aucun utilisateur avec cet e-mail"], ["self", "Vous êtes déjà membre"], ["deja_famille", "Cette personne est déjà dans une famille"]] as const) {
      mock = withFamille(() => ({ data }));
      expect(await inviterMembre(undefined, fd([["email", "x@vito.test"]]))).toEqual({ error: msg });
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("sans foyer → « Aucune famille »", async () => {
    mock = createMockSupabase({ on: () => ({ data: null }), rpc: () => ({ data: "ok" }) });
    expect(await inviterMembre(undefined, fd([["email", "x@vito.test"]]))).toEqual({ error: "Aucune famille" });
  });
  it("refuse sans authentification", async () => {
    mock = withFamille(() => ({ data: "ok" }), null);
    expect(await inviterMembre(undefined, fd([["email", "x@vito.test"]]))).toEqual({ error: "Non authentifié" });
  });
});
