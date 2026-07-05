import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, tableInsert, tableOp, type OpResult } from "@/test/supabaseMock";

// Mocks des dépendances Next/Supabase ; le domaine (computeParts, money) reste RÉEL.
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => mock.client,
}));

import { addDepense, deleteDepense, addRemboursement } from "./actions";

// UUID valides (les schémas utilisent z.guid())
const G1 = "10000000-0000-4000-8000-000000000001";
const A = "20000000-0000-4000-8000-00000000000a";
const B = "30000000-0000-4000-8000-00000000000b";
const DEP = "40000000-0000-4000-8000-000000000d01";

function fd(entries: Array<[string, string]>): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

function setup(opts: Parameters<typeof createMockSupabase>[0]) {
  mock = createMockSupabase(opts);
}

beforeEach(() => revalidatePath.mockClear());

describe("addDepense — glue DB", () => {
  const base: Array<[string, string]> = [
    ["groupeId", G1], ["payePar", A], ["libelle", "Taxi"], ["montant", "30"],
    ["mode", "egal"], ["participants", A], ["participants", B],
  ];

  it("mappe les parts de computeParts vers depense_parts (split égal 30€ → 1500/1500)", async () => {
    setup({ on: (t): OpResult => (t === "depenses" ? { data: { id: DEP } } : { error: null }) });
    const res = await addDepense(undefined, fd(base));
    expect(res).toEqual({ ok: true });
    // la dépense est insérée avec le bon montant en cents
    expect(tableInsert(mock.calls, "depenses")?.payload).toMatchObject({ groupe_id: G1, paye_par: A, montant_cents: 3000, mode: "egal" });
    // les parts somment au total, chaque participant relié à sa part
    const parts = tableInsert(mock.calls, "depense_parts")?.payload as Array<{ depense_id: string; profile_id: string; part_cents: number }>;
    expect(parts).toEqual([
      { depense_id: DEP, profile_id: A, part_cents: 1500 },
      { depense_id: DEP, profile_id: B, part_cents: 1500 },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/depenses/${G1}`);
  });

  it("rollback best-effort : si l'insert des parts échoue, la dépense est supprimée", async () => {
    setup({ on: (t): OpResult => (t === "depenses" ? { data: { id: DEP } } : { error: { message: "boom" } }) });
    const res = await addDepense(undefined, fd(base));
    expect(res).toEqual({ error: "Enregistrement des parts échoué" });
    expect(tableOp(mock.calls, "depenses", "delete")).toBeTruthy(); // rollback tenté
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuse sans authentification", async () => {
    setup({ user: null });
    expect(await addDepense(undefined, fd(base))).toEqual({ error: "Non authentifié" });
  });

  it("rejette une répartition exacte incohérente (parts ≠ total)", async () => {
    setup({ on: (t): OpResult => (t === "depenses" ? { data: { id: DEP } } : { error: null }) });
    const res = await addDepense(undefined, fd([
      ["groupeId", G1], ["payePar", A], ["libelle", "X"], ["montant", "30"],
      ["mode", "exact"], ["participants", A], ["participants", B],
      [`exact:${A}`, "10"], [`exact:${B}`, "5"], // 15€ ≠ 30€
    ]));
    expect(res).toEqual({ error: "Répartition invalide" });
    expect(mock.calls.some((c) => c.kind === "table" && c.table === "depenses" && c.op === "insert")).toBe(false);
  });
});

describe("addRemboursement — mapping", () => {
  it("insère de/vers/montant en cents et revalide", async () => {
    setup({ on: (): OpResult => ({ error: null }) });
    const res = await addRemboursement(undefined, fd([
      ["groupeId", G1], ["deProfileId", A], ["versProfileId", B], ["montant", "12.5"],
    ]));
    expect(res).toEqual({ ok: true });
    expect(tableInsert(mock.calls, "remboursements")?.payload).toMatchObject({
      groupe_id: G1, de_profile_id: A, vers_profile_id: B, montant_cents: 1250,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/depenses/${G1}`);
  });
});

describe("deleteDepense — autorisation via maybeSingle", () => {
  it("0 ligne supprimée (RLS) → non autorisé, pas de revalidation", async () => {
    setup({ on: (): OpResult => ({ data: null, error: null }) });
    const res = await deleteDepense(undefined, fd([["depenseId", DEP], ["groupeId", G1]]));
    expect(res).toEqual({ error: "Suppression non autorisée" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("ligne supprimée → ok + revalidation", async () => {
    setup({ on: (): OpResult => ({ data: { id: DEP }, error: null }) });
    expect(await deleteDepense(undefined, fd([["depenseId", DEP], ["groupeId", G1]]))).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith(`/depenses/${G1}`);
  });
});
