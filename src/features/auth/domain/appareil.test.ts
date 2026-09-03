import { describe, expect, it } from "vitest";
import { cleBiometrie, detecterPlateforme } from "./appareil";

describe("detecterPlateforme", () => {
  it("reconnaît iOS, Android, Windows et macOS", () => {
    expect(detecterPlateforme("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("ios");
    expect(detecterPlateforme("Mozilla/5.0 (Linux; Android 14)")).toBe("android");
    expect(detecterPlateforme("Mozilla/5.0 (Windows NT 10.0; Win64)")).toBe("windows");
    expect(detecterPlateforme("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)")).toBe("macos");
  });
  it("retombe sur « autre » pour un agent inconnu", () => {
    expect(detecterPlateforme("curl/8.0")).toBe("autre");
    expect(detecterPlateforme("")).toBe("autre");
  });
});

describe("cleBiometrie", () => {
  it("donne le libellé attendu par plateforme", () => {
    expect(cleBiometrie("ios")).toBe("biometrie.faceId");
    expect(cleBiometrie("macos")).toBe("biometrie.touchId");
    expect(cleBiometrie("windows")).toBe("biometrie.windowsHello");
    expect(cleBiometrie("autre")).toBe("biometrie.passkey");
  });
});
