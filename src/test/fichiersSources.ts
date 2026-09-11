import { readdirSync } from "node:fs";
import path from "node:path";

export const SRC = path.resolve(__dirname, "..");

/**
 * Les fichiers de `src` qu'un garde-fou doit balayer : le code qu'on écrit,
 * pas ce qui l'éprouve. Vit dans son propre module parce que deux garde-fous
 * s'en servent — une seconde copie finirait par balayer un ensemble différent
 * du premier, et le trou ne se verrait nulle part.
 */
export function fichiersSources(): string[] {
  return readdirSync(SRC, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(ts|tsx|css)$/.test(e.name))
    .map((e) => path.relative(SRC, path.join(e.parentPath, e.name)))
    .filter((p) => !/\.(test|stories)\.tsx?$/.test(p));
}
