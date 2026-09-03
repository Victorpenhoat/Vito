// Lecture humaine d'un user-agent (design écrans 14 et 15 : « iPhone 15 ·
// Mobile · à l'instant »). Volontairement grossier : il ne s'agit que d'aider
// l'utilisateur à reconnaître ses appareils, pas de faire de l'empreinte.

export type TypeAppareil = "mobile" | "tablette" | "ordinateur";

export function typeAppareil(userAgent: string | null): TypeAppareil {
  const ua = (userAgent ?? "").toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablette";
  if (/iphone|android|mobile/.test(ua)) return "mobile";
  return "ordinateur";
}

/** Nom court de l'appareil, deviné depuis l'agent utilisateur. */
export function nomAppareil(userAgent: string | null): string {
  const ua = userAgent ?? "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Appareil";
}
