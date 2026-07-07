import { describe, it, expect, vi, beforeEach } from "vitest";

const envMock = vi.hoisted(() => ({
  env: {
    STRIPE_SECRET_KEY: "sk",
    STRIPE_WEBHOOK_SECRET: "wh",
  } as { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string },
}));
vi.mock("@/lib/env", () => envMock);

const constructEvent = vi.fn();
const sync = vi.fn(async (..._args: unknown[]) => {});
vi.mock("stripe", () => ({
  default: class {
    webhooks = { constructEvent };
  },
}));
vi.mock("@/features/abonnement/data/syncStripe", () => ({ syncSubscriptionFromEvent: (...a: unknown[]) => sync(...a) }));

import { POST } from "./route";

function req(body = "{}") {
  return new Request("http://x/api/stripe/webhook", {
    method: "POST", body, headers: { "stripe-signature": "sig" },
  });
}

beforeEach(() => {
  envMock.env = {
    STRIPE_SECRET_KEY: "sk",
    STRIPE_WEBHOOK_SECRET: "wh",
  };
  constructEvent.mockReset();
  sync.mockClear();
});

describe("POST /api/stripe/webhook", () => {
  it("signature valide → 200 + synchro", async () => {
    constructEvent.mockReturnValue({ type: "checkout.session.completed", data: { object: {} } });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(sync).toHaveBeenCalledOnce();
  });

  it("signature invalide → 400, pas de synchro", async () => {
    constructEvent.mockImplementation(() => { throw new Error("bad sig"); });
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect(sync).not.toHaveBeenCalled();
  });

  it("synchro qui jette → 500 (Stripe rejoue)", async () => {
    constructEvent.mockReturnValue({ type: "checkout.session.completed", data: { object: {} } });
    sync.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(req());
    expect(res.status).toBe(500);
  });

  it("Stripe non configuré (env manquante) → 500, pas de constructEvent ni sync", async () => {
    envMock.env.STRIPE_SECRET_KEY = undefined;
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(constructEvent).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });
});
