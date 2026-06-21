import { describe, it, expect } from "vitest";
import { can } from "./roles";

describe("can", () => {
  it("admin accède au back-office", () => {
    expect(can("admin", "access:admin")).toBe(true);
  });
  it("client n'accède pas au back-office", () => {
    expect(can("client", "access:admin")).toBe(false);
  });
  it("agence peut créer un voyage pour un client", () => {
    expect(can("agence", "create:voyage_pour_client")).toBe(true);
  });
  it("agence n'accède pas au back-office", () => {
    expect(can("agence", "access:admin")).toBe(false);
  });
});
