// Garde SSRF pour le proxy photo : l'URL amont provient de photoUrl(ref), or en mode
// mock (défaut sans clé Google) la ref peut être une URL arbitraire. On n'accepte que
// https vers un hôte connu d'images, et on rejette tout hôte qui est une IP littérale
// privée/loopback/link-local (défense contre les cibles internes type 169.254.169.254).
const ALLOWED_HOSTS = new Set([
  "places.googleapis.com",
  "images.unsplash.com",
]);

function isPrivateIpLiteral(host: string): boolean {
  // IPv6 loopback/link-local (entre crochets dans une URL)
  const h = host.replace(/^\[|\]$/g, "");
  if (h === "::1" || h.toLowerCase().startsWith("fe80:") || h.toLowerCase().startsWith("fc") || h.toLowerCase().startsWith("fd")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // link-local (métadonnées cloud)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

// Retourne true si l'URL amont est sûre à fetch côté serveur.
export function isSafeUpstream(rawUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (isPrivateIpLiteral(u.hostname)) return false;
  return ALLOWED_HOSTS.has(u.hostname);
}
