// Slug d'un tag personnel à partir de son label : minuscules sans accents,
// séparateurs normalisés en underscore (aligné sur les slugs système : date_night).
export function tagSlug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}
