import { getVinsBusIci, getVinsConnus } from "../data/queries";
import { getTagsForCategory } from "@/features/restos/data/queries";
import { VinsDeLaVisite } from "./VinsDeLaVisite";

// Passerelle serveur → client : la section « Vins » du formulaire de visite a
// besoin de données (vins déjà notés aujourd'hui, tags portée vin, vins connus)
// que seul le serveur peut lire. Le formulaire, lui, est client.
export async function VinsDeLaVisiteSlot({ etablissementId, etablissementNom }: {
  etablissementId: string;
  etablissementNom: string;
}) {
  const [bus, vinsConnus, tags] = await Promise.all([
    getVinsBusIci(etablissementId),
    getVinsConnus(),
    getTagsForCategory("vin"),
  ]);
  // Seuls les vins du JOUR : c'est la visite qu'on est en train de saisir, pas
  // l'historique du lieu (celui-ci a son propre bloc sur la fiche).
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const dejaNotes = bus
    .filter((v) => v.degusteLe === aujourdhui)
    .map((v) => ({ intitule: [v.intitule, v.detail].filter(Boolean).join(" · "), note: v.note }));

  return (
    <VinsDeLaVisite dejaNotes={dejaNotes} vinsConnus={vinsConnus} tags={tags}
      etablissementId={etablissementId} etablissementNom={etablissementNom} />
  );
}
