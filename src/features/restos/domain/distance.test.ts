import { describe, expect, it } from "vitest";
import { haversineKm, formatDistance } from "./distance";

describe("haversineKm", () => {
  it("distance nulle au même point", () => {
    expect(haversineKm({ lat: 48.85, lng: 2.35 }, { lat: 48.85, lng: 2.35 })).toBe(0);
  });
  it("Paris → Bordeaux ≈ 500 km", () => {
    const d = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 44.8378, lng: -0.5792 });
    expect(d).toBeGreaterThan(480);
    expect(d).toBeLessThan(520);
  });
});

describe("formatDistance", () => {
  it("mètres sous 1 km, km au-delà (fr)", () => {
    expect(formatDistance(0.85, "fr")).toBe("850 m");
    expect(formatDistance(1.23, "fr")).toBe("1,2 km");
  });
});
