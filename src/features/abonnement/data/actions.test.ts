import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test/supabaseMock";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => mock.client }));

const checkout = vi.fn();
const portalUrl = vi.fn();
vi.mock("@/lib/services/payment", () => ({ getPaymentProvider: () => ({ checkout, portalUrl }) }));

import { subscribe, cancelSubscription } from "./actions";

const fd = (e: Array<[string, string]>) => { const f = new FormData(); e.forEach(([k, v]) => f.append(k, v)); return f; };
const setup = (o: Parameters<typeof createMockSupabase>[0]) => { mock = createMockSupabase(o); };
beforeEach(() => {
  revalidatePath.mockClear();
  checkout.mockReset();
  portalUrl.mockReset();
  checkout.mockResolvedValue({ mode: "activated" });
});

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

describe("subscribe — provider redirect (Stripe)", () => {
  it("provider renvoie redirect → l'action propage {redirect}", async () => {
    setup({ on: () => ({ data: { stripe_customer_id: null }, error: null }) });
    checkout.mockResolvedValueOnce({ mode: "redirect", url: "https://checkout/x" });
    const res = await subscribe(undefined, fd([["period", "monthly"]]));
    expect(res).toEqual({ redirect: "https://checkout/x" });
  });
});

describe("manageSubscription", () => {
  it("avec customer → {redirect} portail", async () => {
    setup({ on: () => ({ data: { stripe_customer_id: "cus_1" }, error: null }) });
    portalUrl.mockResolvedValueOnce("https://portal/y");
    const { manageSubscription } = await import("./actions");
    expect(await manageSubscription(undefined, fd([]))).toEqual({ redirect: "https://portal/y" });
  });
  it("sans customer → {error}", async () => {
    setup({ on: () => ({ data: { stripe_customer_id: null }, error: null }) });
    const { manageSubscription } = await import("./actions");
    expect(await manageSubscription(undefined, fd([]))).toEqual({ error: "Aucun abonnement à gérer" });
  });
});
