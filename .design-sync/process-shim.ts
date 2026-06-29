// next-intl et next/navigation (tirés par @/lib/i18n/routing + le provider intl)
// référencent `process.env` au scope module. Le bundle browser n'a pas de
// `process` → ReferenceError au chargement, qui vide TOUTES les previews (tout
// est dans le même IIFE). esbuild ne remplace que `process.env.NODE_ENV` ; on
// définit donc un `process` minimal AVANT que ces modules ne s'évaluent.
// Importé en première ligne de provider.tsx et entry.tsx (les points d'entrée
// du bundle), donc exécuté avant tout code de composant/lib. Voir NOTES.md.
const g = globalThis as unknown as { process?: { env: Record<string, string | undefined> } };
if (!g.process) g.process = { env: { NODE_ENV: "development" } };
if (!g.process.env) g.process.env = { NODE_ENV: "development" };
export {};
