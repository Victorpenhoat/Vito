import { vi } from "vitest";

// Harnais de mock du client Supabase pour tester les server actions en unitaire
// (sans DB). Chaînable comme le vrai client — .from().insert().select().single(),
// .update().eq().maybeSingle(), .delete().eq(), await direct, .rpc() — et enregistre
// les payloads pour asserter la « glue » (colonnes/valeurs envoyées à la DB).
export type OpResult = { data?: unknown; error?: unknown };
export type RecordedCall =
  | { kind: "table"; table: string; op: "insert" | "update" | "delete" | "select"; payload?: unknown }
  | { kind: "rpc"; name: string; args: unknown };

type Opts = {
  // undefined → user authentifié par défaut ; null → anonyme
  user?: { id: string } | null;
  // réponse par (table, opération terminale) ; défaut { data: null, error: null }
  on?: (table: string, ctx: { op: string; payload?: unknown }) => OpResult;
  rpc?: (name: string, args: unknown) => OpResult;
};

export function createMockSupabase(opts: Opts = {}) {
  const calls: RecordedCall[] = [];
  const user = opts.user === undefined ? { id: "u1" } : opts.user;

  function from(table: string) {
    const state: { op: "insert" | "update" | "delete" | "select"; payload?: unknown } = { op: "select" };
    const result = (): OpResult => (opts.on ? opts.on(table, state) : { data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = {
      insert: (payload: unknown) => { state.op = "insert"; state.payload = payload; calls.push({ kind: "table", table, op: "insert", payload }); return q; },
      update: (payload: unknown) => { state.op = "update"; state.payload = payload; calls.push({ kind: "table", table, op: "update", payload }); return q; },
      delete: () => { state.op = "delete"; calls.push({ kind: "table", table, op: "delete" }); return q; },
      select: () => q,
      eq: () => q,
      in: () => q,
      order: () => q,
      limit: () => q,
      single: async () => result(),
      maybeSingle: async () => result(),
      then: (resolve: (v: OpResult) => void) => resolve(result()),
    };
    return q;
  }

  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: vi.fn(from),
    rpc: vi.fn(async (name: string, args: unknown) => {
      calls.push({ kind: "rpc", name, args });
      return opts.rpc ? opts.rpc(name, args) : { data: null, error: null };
    }),
  };
  return { client, calls };
}

// Sélecteurs d'assertion sur les appels enregistrés.
export const tableInsert = (calls: RecordedCall[], table: string) =>
  calls.find((c) => c.kind === "table" && c.table === table && c.op === "insert") as
    | (RecordedCall & { kind: "table"; payload: unknown }) | undefined;
export const tableOp = (calls: RecordedCall[], table: string, op: string) =>
  calls.find((c) => c.kind === "table" && c.table === table && c.op === op);
export const rpcCall = (calls: RecordedCall[], name: string) =>
  calls.find((c) => c.kind === "rpc" && c.name === name);
