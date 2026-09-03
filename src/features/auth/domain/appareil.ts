// Libellé du geste biométrique selon l'appareil (design Onboarding écran 4 :
// « Activer Face ID » / « Touch ID » / « Windows Hello »). Purement cosmétique :
// la cérémonie WebAuthn est identique partout.

export type Plateforme = "ios" | "macos" | "windows" | "android" | "autre";

export function detecterPlateforme(userAgent: string): Plateforme {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/windows/.test(ua)) return "windows";
  // iPadOS se présente comme un Mac : on ne peut pas les distinguer ici, et le
  // libellé « Touch ID » reste acceptable dans les deux cas.
  if (/macintosh|mac os x/.test(ua)) return "macos";
  return "autre";
}

/** Clé i18n du libellé du bouton biométrique. */
export function cleBiometrie(plateforme: Plateforme): string {
  switch (plateforme) {
    case "ios": return "biometrie.faceId";
    case "macos": return "biometrie.touchId";
    case "windows": return "biometrie.windowsHello";
    case "android": return "biometrie.android";
    default: return "biometrie.passkey";
  }
}
