// Participants d'un voyage (Lot B) : qui part.
//
// À ne pas confondre avec `voyage_membres`, qui dit avec quels COMPTES le
// voyage est partagé. Un enfant de trois ans voyage sans compte ; une agence a
// un compte sans voyager. Les deux listes se croisent, elles ne se confondent
// pas.

export type Participant = {
  id: string;
  profileId: string | null;
  familyMemberId: string | null;
  /** Instantané du nom : il survit à la disparition de sa source. */
  displayName: string;
  email: string | null;
  role: "organisateur" | "voyageur";
};

export type SourceParticipant = "compte" | "cercle" | "libre";

/**
 * D'où vient ce voyageur. Un proche supprimé du Cercle voit son lien mis à
 * null : il devient « libre », et garde son nom — c'est voulu.
 */
export function sourceParticipant(p: Participant): SourceParticipant {
  if (p.profileId) return "compte";
  if (p.familyMemberId) return "cercle";
  return "libre";
}

/** Les proches du Cercle qu'on peut encore ajouter (l'identité, pas le nom). */
export function candidatsCercle<T extends { id: string }>(proches: T[], participants: Participant[]): T[] {
  const pris = new Set(participants.map((p) => p.familyMemberId).filter(Boolean));
  return proches.filter((pr) => !pris.has(pr.id));
}

/** Les comptes avec qui le voyage est partagé et qui n'en sont pas encore. */
export function candidatsComptes<T extends { profileId: string }>(membres: T[], participants: Participant[]): T[] {
  const pris = new Set(participants.map((p) => p.profileId).filter(Boolean));
  return membres.filter((m) => !pris.has(m.profileId));
}

/** Organisateurs d'abord, puis par nom — accents ignorés (localeCompare fr). */
export function trierParticipants(participants: Participant[]): Participant[] {
  const rang = (p: Participant) => (p.role === "organisateur" ? 0 : 1);
  return [...participants].sort(
    (a, b) => rang(a) - rang(b) || a.displayName.localeCompare(b.displayName, "fr"),
  );
}
