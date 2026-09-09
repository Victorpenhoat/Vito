import { z } from "zod";
import { TYPES_ACTIVITE, STATUTS_ACTIVITE } from "./activite";
import { centsFromEuros } from "@/features/depenses/domain/money";

// `z.guid()` et non `z.uuid()` : Zod v4 vérifie la variante RFC, et rejetait
// des identifiants pourtant valides (piège rencontré sur les voyageurs).
const id = z.guid();
const texte = (max: number) => z.string().trim().min(1).max(max);
const optionnel = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
/** « HH:MM », telle que la rend un <input type="time">. */
const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide");

export const activiteInputSchema = z.object({
  type: z.enum(TYPES_ACTIVITE),
  nom: texte(200),
  statut: z.enum(STATUTS_ACTIVITE).default("en_cours"),
  clubNom: optionnel(200),
  adresse: optionnel(400),
  // Coordonnées apportées par la suggestion choisie. Elles vont par paire :
  // une latitude sans sa longitude ne situe rien.
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  placeId: optionnel(200),
  telephone: optionnel(40),
  // Formule à la carte : vide = abonnement illimité, pas zéro séance.
  formuleSeances: z.coerce.number().int().positive().optional(),
  // Le second contact — « Claire, monitrice » — va par paire : un numéro sans
  // nom ne dit pas qui décroche.
  contactNom: optionnel(120),
  contactTelephone: optionnel(40),
  membres: z.array(id).default([]),
});
export type ActiviteInput = z.infer<typeof activiteInputSchema>;

export const creneauInputSchema = z
  .object({
    activiteId: id,
    jourSemaine: z.coerce.number().int().min(1).max(7),
    heureDebut: heure,
    heureFin: heure,
    lieuPrecision: optionnel(200),
    intervenant: optionnel(200),
    deposePar: id.optional(),
  })
  .refine((c) => c.heureFin > c.heureDebut, {
    message: "Un créneau ne peut pas finir avant de commencer",
    path: ["heureFin"],
  });
export type CreneauInput = z.infer<typeof creneauInputSchema>;

export const paiementInputSchema = z.object({
  activiteId: id,
  libelle: texte(200),
  // Réutilise le parseur d'euros du carnet : « 310 », « 310,50 » ou « 310.50 ».
  montantCents: centsFromEuros,
  echeance: z.string().date().optional(),
  periodicite: z.enum(["seance", "unique", "mensuelle", "trimestrielle", "annuelle"]).optional(),
  moyen: z.enum(["prelevement", "carte", "virement", "cheque", "especes", "autre"]).optional(),
});

export const reglerPaiementSchema = z.object({
  paiementId: id,
  activiteId: id,
  /** Un règlement se défait : on a pu cocher trop vite. */
  paye: z.enum(["oui", "non"]),
});

export const statutActiviteSchema = z.object({
  activiteId: id,
  statut: z.enum(STATUTS_ACTIVITE),
});
