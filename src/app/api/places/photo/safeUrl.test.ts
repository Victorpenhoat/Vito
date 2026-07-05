import { describe, it, expect } from "vitest";
import { isSafeUpstream } from "./safeUrl";

describe("isSafeUpstream — garde SSRF du proxy photo", () => {
  it("accepte les hôtes d'images connus en https", () => {
    expect(isSafeUpstream("https://places.googleapis.com/v1/x/media?key=k")).toBe(true);
    expect(isSafeUpstream("https://images.unsplash.com/photo-123")).toBe(true);
  });

  it("rejette les cibles internes (métadonnées cloud, loopback, RFC1918)", () => {
    expect(isSafeUpstream("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isSafeUpstream("https://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isSafeUpstream("http://127.0.0.1:8080/")).toBe(false);
    expect(isSafeUpstream("https://10.0.0.5/")).toBe(false);
    expect(isSafeUpstream("https://192.168.1.1/")).toBe(false);
    expect(isSafeUpstream("https://172.16.0.1/")).toBe(false);
    expect(isSafeUpstream("https://[::1]/")).toBe(false);
  });

  it("rejette les hôtes hors allowlist et les schémas non-https", () => {
    expect(isSafeUpstream("https://evil.example.com/x.jpg")).toBe(false);
    expect(isSafeUpstream("http://places.googleapis.com/x")).toBe(false); // http nu refusé
    expect(isSafeUpstream("file:///etc/passwd")).toBe(false);
    expect(isSafeUpstream("pas une url")).toBe(false);
  });
});
