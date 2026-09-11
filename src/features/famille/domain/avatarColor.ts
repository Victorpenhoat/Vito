// Cinq teintes d'avatar, choisies pour se distinguer sur la surface sombre
// #131A26 et entre elles. `#211E1A` (l'encre du thème clair) en faisait
// partie : sur fond nuit, il disparaissait.
export const AVATAR_PALETTE = ["#3E5A8C", "#5C7A99", "#6E5C8C", "#4A7A6B", "#8C6A5C"] as const;

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]!;
}
