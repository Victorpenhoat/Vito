import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({ env: { STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh" } }));

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

beforeEach(() => { constructEvent.mockReset(); sync.mockClear(); });

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
});
