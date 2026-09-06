import { describe, it, expect, vi, afterEach } from "vitest";
import { FrankfurterTauxProvider } from "./frankfurter";

const provider = new FrankfurterTauxProvider("https://taux.example/v1/");

function repond(corps: unknown, ok = true) {
  const mock = vi.fn().mockResolvedValue({ ok, json: async () => corps } as Response);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe("FrankfurterTauxProvider", () => {
  it("demande la conversion à la date de la dépense et rend le taux", async () => {
    const fetchMock = repond({ base: "USD", date: "2026-10-14", rates: { EUR: 0.9207 } });
    expect(await provider.taux("USD", "EUR", "2026-10-14"))
      .toEqual({ taux: 0.9207, date: "2026-10-14" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://taux.example/v1/2026-10-14?base=USD&symbols=EUR");
  });

  it("rend le jour ouvré retenu, pas celui demandé : un dimanche prend le vendredi", async () => {
    repond({ date: "2026-10-16", rates: { EUR: 0.92 } });
    expect(await provider.taux("USD", "EUR", "2026-10-18")).toMatchObject({ date: "2026-10-16" });
  });

  it("ne sort pas sur le réseau pour une conversion vers la même devise", async () => {
    const fetchMock = repond({});
    expect(await provider.taux("EUR", "EUR", "2026-10-14")).toEqual({ taux: 1, date: "2026-10-14" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ne rend rien plutôt qu'un taux inventé : service en panne, devise inconnue, réponse absurde", async () => {
    repond({}, false);
    expect(await provider.taux("USD", "EUR", "2026-10-14")).toBeNull();
    repond({ date: "2026-10-14", rates: {} });
    expect(await provider.taux("XXX", "EUR", "2026-10-14")).toBeNull();
    repond({ date: "2026-10-14", rates: { EUR: 0 } });
    expect(await provider.taux("USD", "EUR", "2026-10-14")).toBeNull();
    repond({ date: "2026-10-14", rates: { EUR: "0,92" } });
    expect(await provider.taux("USD", "EUR", "2026-10-14")).toBeNull();
  });

  it("un réseau qui échoue ou traîne ne fait pas échouer la dépense", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await provider.taux("USD", "EUR", "2026-10-14")).toBeNull();
  });

  it("refuse un code de devise qui n'en est pas un", async () => {
    const fetchMock = repond({ rates: { EUR: 1 } });
    expect(await provider.taux("dollars", "EUR", "2026-10-14")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
