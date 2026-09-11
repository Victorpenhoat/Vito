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

/**
 * Le code d'un fichier, ses commentaires retirés.
 *
 * Un garde-fou qui lit les commentaires ne peut pas être expliqué : le
 * commentaire qui dit « n'écrivez pas `text-white` » compte alors comme un
 * `text-white`. Pire, il maintient son fichier en dette une fois celle-ci
 * payée, et le test qui surveille la dette se tait.
 *
 * On ne retire que les blocs et les lignes ENTIÈREMENT commentées : un `//` en
 * milieu de ligne est le plus souvent un `https://`, et le retirer masquerait
 * ce qui suit.
 */
export function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");
}
