export const AVATAR_PALETTE = ["#211E1A", "#6B7A8F", "#8A7A64", "#9A8466", "#5E7163"] as const;

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]!;
}
