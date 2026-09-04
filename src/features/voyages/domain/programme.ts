// Programme d'un voyage (Lot B) : les étapes, rangées par jour.
//
// Deux règles tiennent tout : un jour du voyage reste affiché même vide (c'est
// une journée à remplir, pas une absence), et une étape qui ne tombe dans aucun
// jour connu rejoint « à caler » — jamais elle ne disparaît de l'écran.

export type Etape = {
  id: string;
  /** « YYYY-MM-DD » ou null (envie sans date). */
  jour: string | null;
  /** « HH:MM » ou null. */
  heure: string | null;
  titre: string;
  lieu: string | null;
  etablissementId: string | null;
  notes: string | null;
  ordre: number;
};

export type JourProgramme = { jour: string; etapes: Etape[] };

const JOUR_MS = 86_400_000;

/**
 * Les jours d'un voyage, bornes comprises. Sans retour, le voyage tient à son
 * jour de départ : dérouler au-delà inventerait une durée.
 */
export function joursDuVoyage(debut: string | null, fin: string | null): string[] {
  if (!debut) return [];
  const depart = Date.parse(`${debut}T00:00:00Z`);
  const retour = fin ? Date.parse(`${fin}T00:00:00Z`) : depart;
  if (Number.isNaN(depart) || Number.isNaN(retour)) return [];
  // Un retour antérieur au départ est une saisie fautive, pas une liste inversée.
  const dernier = Math.max(depart, retour);
  const jours: string[] = [];
  for (let t = depart; t <= dernier; t += JOUR_MS) {
    jours.push(new Date(t).toISOString().slice(0, 10));
  }
  return jours;
}

/**
 * Range les étapes sous les jours du voyage. Ce qui n'a pas de jour — ou tombe
 * hors du voyage, après un changement de dates — va dans « à caler ».
 */
export function grouperEtapes(etapes: Etape[], jours: string[]): {
  jours: JourProgramme[];
  aCaler: Etape[];
} {
  const connus = new Set(jours);
  const parJour = new Map<string, Etape[]>(jours.map((j) => [j, []]));
  const aCaler: Etape[] = [];

  for (const e of etapes) {
    if (e.jour && connus.has(e.jour)) parJour.get(e.jour)!.push(e);
    else aCaler.push(e);
  }

  return {
    jours: jours.map((jour) => ({ jour, etapes: [...(parJour.get(jour) ?? [])].sort(ordreDuJour) })),
    aCaler,
  };
}

/**
 * Dans une journée : ce qui a une heure d'abord, à l'heure dite ; le reste
 * ensuite, dans l'ordre où on l'a rangé.
 */
function ordreDuJour(a: Etape, b: Etape): number {
  if (a.heure && b.heure) return a.heure.localeCompare(b.heure);
  if (a.heure) return -1;
  if (b.heure) return 1;
  return a.ordre - b.ordre;
}
