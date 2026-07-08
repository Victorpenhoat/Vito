import { describe, it, expect, vi, afterEach } from "vitest";
import { formatLog, errorContext, log, setErrorSink } from "./log";

describe("formatLog", () => {
  const ISO = "2026-07-05T10:00:00.000Z";
  it("dev : lisible avec niveau, event et contexte", () => {
    // NODE_ENV = "test" en vitest → branche non-prod (lisible)
    expect(formatLog("error", "action.failed", { name: "toggleFavorite" }, ISO))
      .toBe('[error] action.failed {"name":"toggleFavorite"}');
  });
  it("dev : sans contexte, pas d'accolades vides", () => {
    expect(formatLog("info", "boot", undefined, ISO)).toBe("[info] boot");
    expect(formatLog("warn", "boot", {}, ISO)).toBe("[warn] boot");
  });
});

describe("errorContext", () => {
  it("extrait message et digest d'une Error", () => {
    const e = Object.assign(new Error("boom"), { digest: "abc123" });
    expect(errorContext(e)).toEqual({ message: "boom", digest: "abc123" });
  });
  it("gère une Error sans digest", () => {
    expect(errorContext(new Error("x"))).toEqual({ message: "x" });
  });
  it("stringifie une valeur non-Error", () => {
    expect(errorContext("nope")).toEqual({ message: "nope" });
  });
});

describe("errorSink (forward des erreurs)", () => {
  afterEach(() => {
    setErrorSink(null);
    vi.restoreAllMocks();
  });

  it("emit(error) appelle le sink avec (event, ctx)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = vi.fn();
    setErrorSink(sink);
    log.error("action.failed", { name: "toggleFavorite" });
    expect(sink).toHaveBeenCalledWith("action.failed", { name: "toggleFavorite" });
  });

  it("emit(error) sans ctx appelle le sink avec un objet vide", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = vi.fn();
    setErrorSink(sink);
    log.error("boom");
    expect(sink).toHaveBeenCalledWith("boom", {});
  });

  it("warn/info n'appellent PAS le sink", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    const sink = vi.fn();
    setErrorSink(sink);
    log.warn("w");
    log.info("i");
    expect(sink).not.toHaveBeenCalled();
  });

  it("sans sink enregistré : aucun throw, console seule", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("no-sink");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("setErrorSink(null) détache", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = vi.fn();
    setErrorSink(sink);
    setErrorSink(null);
    log.error("x");
    expect(sink).not.toHaveBeenCalled();
  });
});
