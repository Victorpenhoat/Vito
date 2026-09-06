import { ageYears } from "@/features/famille/domain/age";

// Participants (maquette « Participants ») : deux groupes, pas une liste plate.
//
// « Depuis mon cercle » rassemble ceux qu'on connaît déjà — proches du Cercle,
// comptes partagés, ou noms saisis à la main. « Invités externes » ne contient
// que ceux qu'on a conviés par e-mail, et dont l'invitation peut être encore en
// attente : c'est une information d'un autre ordre, elle mérite son groupe.

export type ParticipantDetaille = {
  id: string;
  profileId: string | null;
  familyMemberId: string | null;
  displayName: string;
  email: string | null;
  role: "organisateur" | "voyageur";
  typeVoyageur: "adulte" | "enfant";
  /** Depuis la fiche du proche : jamais recopiée ici, elle deviendrait fausse. */
  dateNaissance: string | null;
  invitationEnAttente: boolean;
};

/** L'organisateur d'abord, puis l'ordre alphabétique — accents compris. */
function trier(liste: ParticipantDetaille[]): ParticipantDetaille[] {
  const rang = (p: ParticipantDetaille) => (p.role === "organisateur" ? 0 : 1);
  return [...liste].sort((a, b) => rang(a) - rang(b) || a.displayName.localeCompare(b.displayName, "fr"));
}

export function grouperParticipants(participants: ParticipantDetaille[]): {
  cercle: ParticipantDetaille[];
  externes: ParticipantDetaille[];
} {
  // Un invité externe se reconnaît à son e-mail : c'est par là qu'on l'a convié.
  const externe = (p: ParticipantDetaille) => p.email != null && p.familyMemberId == null;
  return {
    cercle: trier(participants.filter((p) => !externe(p))),
    externes: trier(participants.filter(externe)),
  };
}

export type LibelleVoyageur =
  | { cle: "organisateur" }
  | { cle: "adulte" }
  | { cle: "enfant" }
  | { cle: "enfantAge"; age: number }
  | { cle: "enAttente" };

/**
 * Ce qu'on dit d'un voyageur sous son nom. L'âge d'un enfant vient de sa fiche
 * du Cercle — s'il n'y en a pas, on le dit enfant sans inventer de chiffre.
 */
export function libelleVoyageur(p: ParticipantDetaille, aujourdhui: Date): LibelleVoyageur {
  if (p.role === "organisateur") return { cle: "organisateur" };
  if (p.invitationEnAttente) return { cle: "enAttente" };
  if (p.typeVoyageur === "enfant") {
    const age = p.dateNaissance ? ageYears(p.dateNaissance, aujourdhui) : null;
    return age != null ? { cle: "enfantAge", age } : { cle: "enfant" };
  }
  return { cle: "adulte" };
}
