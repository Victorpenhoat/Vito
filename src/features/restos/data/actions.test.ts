import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, tableInsert, type OpResult } from "@/test/supabaseMock";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => mock.client }));

import { toggleFavorite, addAvis, setTags } from "./actions";

const ETAB = "10000000-0000-4000-8000-0000000000e1";
const LI = "20000000-0000-4000-8000-000000000021";
const TAG = "30000000-0000-4000-8000-000000000031";

function fd(entries: Array<[string, string]>): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}
const setup = (o: Parameters<typeof createMockSupabase>[0]) => { mock = createMockSupabase(o); };
beforeEach(() => revalidatePath.mockClear());

describe("toggleFavorite — revalide fiches resto ET hôtel (fix #88)", () => {
  it("revalide /restos et /hotels en type layout", async () => {
    setup({ on: (): OpResult => ({ error: null }) });
    await toggleFavorite(undefined, fd([["listeItemId", LI], ["isFavorite", "true"]]));
    expect(revalidatePath).toHaveBeenCalledWith("/restos", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/hotels", "layout");
  });
  it("refuse sans authentification", async () => {
    setup({ user: null });
    expect(await toggleFavorite(undefined, fd([["listeItemId", LI], ["isFavorite", "true"]]))).toEqual({ error: "Non authentifié" });
  });
});

describe("addAvis — mapping + revalide les deux catégories (fix #88)", () => {
  it("insère user_id/etab/note et revalide /restos/[id] ET /hotels/[id]", async () => {
    setup({ on: (): OpResult => ({ error: null }) });
    const res = await addAvis(undefined, fd([["etablissementId", ETAB], ["note", "4"], ["commentaire", "Top"]]));
    expect(res).toEqual({});
    expect(tableInsert(mock.calls, "avis")?.payload).toMatchObject({ user_id: "u1", etablissement_id: ETAB, note: 4, commentaire: "Top" });
    expect(revalidatePath).toHaveBeenCalledWith(`/restos/${ETAB}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/hotels/${ETAB}`);
  });
});

describe("setTags — delete puis insert (non transactionnel)", () => {
  it("si le delete échoue, pas d'insert ni de succès", async () => {
    setup({ on: (t): OpResult => (t === "liste_item_tags" ? { error: { message: "boom" } } : { error: null }) });
    const res = await setTags(undefined, fd([["listeItemId", LI], ["tagIds", TAG]]));
    expect(res).toEqual({ error: "Mise à jour des tags échouée" });
  });
});
