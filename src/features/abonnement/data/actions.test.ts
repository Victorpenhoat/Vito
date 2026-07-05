import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test/supabaseMock";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => mock.client }));

import { subscribe, cancelSubscription } from "./actions";

const fd = (e: Array<[string, string]>) => { const f = new FormData(); e.forEach(([k, v]) => f.append(k, v)); return f; };
const setup = (o: Parameters<typeof createMockSupabase>[0]) => { mock = createMockSupabase(o); };
beforeEach(() => revalidatePath.mockClear());

describe("subscribe — mode mock (Stripe différé)", () => {
  it("période valide → mock_subscribe puis revalide abonnement + voyages", async () => {
    setup({ rpc: () => ({ error: null }) });
    const res = await subscribe(undefined, fd([["period", "monthly"]]));
    expect(res).toEqual({ ok: true });
    expect(mock.calls.find((c) => c.kind === "rpc")).toMatchObject({ name: "mock_subscribe", args: { p_period: "monthly" } });
    expect(revalidatePath).toHaveBeenCalledWith("/abonnement");
    expect(revalidatePath).toHaveBeenCalledWith("/voyages");
  });
  it("période invalide → refus", async () => {
    setup({});
    expect(await subscribe(undefined, fd([["period", "weekly"]]))).toEqual({ error: "Période invalide" });
  });
  it("refuse sans authentification", async () => {
    setup({ user: null });
    expect(await subscribe(undefined, fd([["period", "yearly"]]))).toEqual({ error: "Non authentifié" });
  });
});

describe("cancelSubscription", () => {
  it("appelle cancel_subscription et revalide", async () => {
    setup({ rpc: () => ({ error: null }) });
    expect(await cancelSubscription(undefined, fd([]))).toEqual({ ok: true });
    expect(mock.calls.find((c) => c.kind === "rpc")).toMatchObject({ name: "cancel_subscription" });
  });
});
