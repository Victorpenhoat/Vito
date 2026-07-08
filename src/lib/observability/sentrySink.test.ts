import { describe, it, expect, vi, beforeEach } from "vitest";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...a) }));

import { sentryErrorSink } from "./sentrySink";

beforeEach(() => captureException.mockClear());

describe("sentryErrorSink", () => {
  it("forwarde une Error reconstruite + event en tag + reste du ctx en extra", () => {
    sentryErrorSink("action.failed", { message: "boom", name: "toggleFavorite", digest: "d1" });
    expect(captureException).toHaveBeenCalledTimes(1);
    const [err, opts] = captureException.mock.calls[0] as unknown[];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("boom");
    expect(opts).toEqual({ tags: { event: "action.failed" }, extra: { name: "toggleFavorite", digest: "d1" } });
  });

  it("sans message dans le ctx : retombe sur l'event comme message", () => {
    sentryErrorSink("global_error", {});
    const [err, opts] = captureException.mock.calls[0] as unknown[];
    expect((err as Error).message).toBe("global_error");
    expect(opts).toEqual({ tags: { event: "global_error" }, extra: {} });
  });
});
