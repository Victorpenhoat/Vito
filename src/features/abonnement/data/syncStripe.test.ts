import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/test/supabaseMock";

// "server-only" throw inconditionnellement hors bundler Next (pas de condition
// d'export "react-server" sous Vitest) — no-op pour ce test unitaire du module lui-même.
vi.mock("server-only", () => ({}));

let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mock.client }));

import { syncSubscriptionFromEvent } from "./syncStripe";

// current_period_end vit sur l'item (Stripe SDK v22+/API récente), pas sur la
// subscription elle-même.
const sub = {
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  items: { data: [{ price: { recurring: { interval: "month" } }, current_period_end: 1893456000 }] }, // 2030-01-01
  metadata: {},
};

function stripeStub(retrieved: unknown) {
  return { subscriptions: { retrieve: vi.fn(async () => retrieved) } };
}

beforeEach(() => { mock = createMockSupabase({ on: () => ({ data: null, error: null }) }); });

describe("syncSubscriptionFromEvent", () => {
  it("checkout.session.completed → upsert subscriptions active", async () => {
    const s = stripeStub(sub);
    const event = { type: "checkout.session.completed", data: { object: { client_reference_id: "u1", subscription: "sub_1", customer: "cus_1" } } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncSubscriptionFromEvent(event as any, s as any);
    const call = mock.calls.find((c) => c.kind === "table" && c.op === "insert");
    expect(call).toMatchObject({ table: "subscriptions", op: "insert" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (call as any).payload;
    expect(payload).toMatchObject({
      user_id: "u1", status: "active", period: "monthly",
      stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1",
    });
    expect(payload.current_period_end).toBe("2030-01-01T00:00:00.000Z");
  });

  it("customer.subscription.deleted → upsert canceled", async () => {
    // Le handler dérive le statut de la ressource RETRIEVE (source de vérité), pas du
    // payload de l'event : le stub doit donc refléter l'état canceled ici.
    const s = stripeStub({ ...sub, status: "canceled" });
    const event = { type: "customer.subscription.deleted", data: { object: { ...sub, status: "canceled", metadata: { user_id: "u1" } } } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncSubscriptionFromEvent(event as any, s as any);
    const call = mock.calls.find((c) => c.kind === "table" && c.op === "insert");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((call as any).payload).toMatchObject({ user_id: "u1", status: "canceled" });
  });

  it("type non géré → aucun appel DB", async () => {
    const s = stripeStub(sub);
    const event = { type: "invoice.paid", data: { object: {} } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncSubscriptionFromEvent(event as any, s as any);
    expect(mock.calls.length).toBe(0);
  });

  it("customer.subscription.updated sans metadata.user_id → fallback par stripe_customer_id", async () => {
    // La sub Stripe n'a pas de metadata.user_id (sub créée avant le fix checkout, ou perdue) :
    // le select-by-customer doit prendre le relais, l'upsert doit malgré tout aboutir.
    mock = createMockSupabase({
      on: (table, ctx) => (ctx.op === "select" ? { data: { user_id: "u1" }, error: null } : { data: null, error: null }),
    });
    const s = stripeStub(sub); // sub.metadata === {}
    const event = { type: "customer.subscription.updated", data: { object: { ...sub, metadata: {} } } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncSubscriptionFromEvent(event as any, s as any);
    const call = mock.calls.find((c) => c.kind === "table" && c.op === "insert");
    expect(call).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((call as any).payload).toMatchObject({ user_id: "u1", stripe_customer_id: "cus_1" });
  });
});
