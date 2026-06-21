// Clé de dédoublonnage alignée sur l'index unique SQL
// (user_id, lower(nom), coalesce(millesime,0), lower(coalesce(domaine,''))).
export function vinDedupKey(v: {
  nom: string;
  millesime: number | null;
  domaine: string | null;
}): string {
  const nom = v.nom.trim().toLowerCase();
  const millesime = v.millesime ?? 0;
  const domaine = (v.domaine ?? "").trim().toLowerCase();
  return `${nom} ${millesime} ${domaine}`;
}
