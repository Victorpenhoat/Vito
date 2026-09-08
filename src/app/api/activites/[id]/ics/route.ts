import { type NextRequest, NextResponse } from "next/server";
import { getActiviteDetail } from "@/features/activites/data/queries";
import { versIcs } from "@/features/activites/domain/ics";

// « Ajouter au calendrier » : le fichier iCalendar des créneaux d'une activité.
//
// Rien de protégé ici — des horaires et un lieu, pas un code ni un document.
// La RLS suffit donc : une activité qui n'est pas à moi ne remonte pas, et
// répond 404 comme si elle n'existait pas.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const activite = await getActiviteDetail(id, aujourdhui);
  if (!activite) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const ics = versIcs(
    {
      id: activite.id,
      nom: activite.nom,
      clubNom: activite.clubNom,
      adresse: activite.adresse,
      saisonDebut: activite.saisonDebut,
      saisonFin: activite.saisonFin,
      creneaux: activite.creneauxDetail,
    },
    aujourdhui,
  );

  // Nom de fichier normalisé : les agendas s'en servent tel quel.
  const fichier = activite.nom.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").toLowerCase().replace(/^-|-$/g, "") || "activite";

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fichier}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
