import { describe, it, expect } from "vitest";
import { formatLog, errorContext } from "./log";

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
