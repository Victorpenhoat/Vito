// En-têtes de sécurité de Vito.
//
// Deux natures distinctes, et c'est volontaire :
//
// - Les en-têtes STATIQUES ne dépendent d'aucune requête. Ils sont posés par
//   next.config.ts sur toutes les routes, y compris /api et les fichiers
//   servis par Next, que le proxy ne voit pas.
// - La CSP dépend d'une nonce tirée à chaque requête, donc elle vit dans le
//   proxy, seul endroit qui s'exécute avant le rendu.
//
// Le cœur est ici, pur et testable : ni next.config ni le proxy ne construisent
// une chaîne à la main.

/** Origine d'une URL, ou null si elle est absente ou illisible. */
export function origine(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export type EntetesStatique = { key: string; value: string };

// Ce que le navigateur doit savoir sans qu'on le lui demande deux fois.
// `geolocation` et `camera` restent ouverts À NOUS SEULS : le premier sert au
// « ~22 min depuis chez nous » des Activités, le second aux tunnels photo
// (étiquette de vin, ticket de dépense) qui ouvrent l'appareil photo natif.
// Tout le reste est refusé, y compris le paiement — Stripe se fait par
// redirection vers son domaine, jamais dans notre page.
export const ENTETES_STATIQUES: readonly EntetesStatique[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "geolocation=(self)",
      "camera=(self)",
      "microphone=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "interest-cohort=()",
    ].join(", "),
  },
];

export type OptionsCsp = {
  nonce: string;
  /** En dev, React évalue du code pour reconstruire les piles d'erreur. */
  dev: boolean;
  /** Origine Supabase : REST, Auth et Storage y sont appelés depuis le navigateur. */
  supabase: string | null;
  /** Origine Sentry, seulement si un DSN est configuré. */
  sentry: string | null;
};

/**
 * Construit la valeur de la CSP.
 *
 * Deux assouplissements assumés, tous deux limités aux styles :
 *
 * - `style-src-attr 'unsafe-inline'` : Leaflet positionne ses tuiles et ses
 *   marqueurs en écrivant `element.style`, et React rend `style={{…}}` en
 *   attribut. Sans cela la carte ne s'affiche pas. Une injection de style ne
 *   permet pas d'exécuter du code ; on ne cède rien sur `script-src`.
 * - `img-src` autorise les tuiles OpenStreetMap, seule ressource visuelle que
 *   nous chargions hors de notre origine — les photos de lieux passent par
 *   notre proxy, donc par `'self'`.
 */
export function construireCsp({ nonce, dev, supabase, sentry }: OptionsCsp): string {
  const connect = ["'self'", supabase, sentry, dev ? "ws:" : null].filter(Boolean);
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    // Ce que NOUS pouvons encadrer — à ne pas confondre avec `frame-ancestors`,
    // plus bas, qui dit qui peut nous encadrer et reste fermé. Un scan de
    // document en PDF s'affiche dans une iframe de notre origine
    // (`ScanProtege`) : à 'none', l'utilisateur redonne son mot de passe pour
    // ne rien voir, et le ticket à usage unique n'est même pas consommé.
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-uri /api/csp-report",
    dev ? null : "upgrade-insecure-requests",
  ].filter(Boolean);
  return directives.join("; ");
}
