import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVacancesProvider } from "@/lib/services/vacances";
import { log, errorContext } from "@/lib/log";
import type { Periode } from "../domain/planning";

/**
 * Années scolaires couvrant une fenêtre. L'année bascule au 1er septembre :
 * une fenêtre de douze mois ouverte en janvier en chevauche donc deux, et
 * n'en récupérer qu'une laisserait un trou au milieu de la frise.
 */
export function anneesScolairesDe(debut: string, fin: string): string[] {
  const annee = (d: string) => {
    const [a, m] = [Number(d.slice(0, 4)), Number(d.slice(5, 7))];
    const premiere = m >= 9 ? a : a - 1;
    return `${premiere}-${premiere + 1}`;
  };
  const [a, b] = [annee(debut), annee(fin)];
  if (a === b) return [a];
  const out: string[] = [];
  for (let y = Number(a.slice(0, 4)); y <= Number(b.slice(0, 4)); y++) out.push(`${y}-${y + 1}`);
  return out;
}

async function lire(zone: string, annees: string[]) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("vacances_scolaires")
    .select("annee_scolaire, zone, libelle, debut, fin")
    .eq("zone", zone)
    .in("annee_scolaire", annees)
    .order("debut");
  if (error) {
    log.warn("vacances_lecture", { message: error.message });
    return [];
  }
  return data ?? [];
}

/**
 * Le calendrier d'une zone sur une fenêtre. Sert TOUJOURS ce que la table
 * contient ; ne va chercher que l'année absente.
 *
 * On ne rafraîchit jamais ce qu'on a déjà : la règle est volontairement bête,
 * et sa conséquence est assumée — une date corrigée après coup par le
 * ministère reste l'ancienne, et le remède est de supprimer les lignes de
 * l'année. Une politique de fraîcheur coûterait un réglage et une tempête de
 * requêtes à chaque rentrée, pour un problème rare.
 *
 * Ne jette jamais : un calendrier absent dégrade l'écran, il ne le casse pas.
 */
export async function getVacances(zone: string, debut: string, fin: string): Promise<Periode[]> {
  const annees = anneesScolairesDe(debut, fin);
  let lignes = await lire(zone, annees);

  const presentes = new Set(lignes.map((l) => l.annee_scolaire));
  const manquantes = annees.filter((a) => !presentes.has(a));

  if (manquantes.length > 0) {
    const provider = getVacancesProvider();

    // Un seul client, pas un par année manquante. Sa création est protégée :
    // la clé de service est optionnelle (cf. `env.ts`) et `createAdminClient()`
    // jette si elle manque — une absence de configuration doit dégrader
    // l'écran, pas le faire tomber.
    let admin: ReturnType<typeof createAdminClient> | null = null;
    try {
      admin = createAdminClient();
    } catch (err) {
      log.warn("vacances_ecriture", errorContext(err));
    }

    for (const annee of manquantes) {
      const periodes = await provider.recuperer(annee);
      if (!periodes || periodes.length === 0 || !admin) continue;
      const { error } = await admin
        .from("vacances_scolaires")
        .upsert(
          periodes.map((p) => ({
            annee_scolaire: p.anneeScolaire, zone: p.zone,
            libelle: p.libelle, debut: p.debut, fin: p.fin,
          })),
          { onConflict: "annee_scolaire,zone,libelle" },
        );
      if (error) log.warn("vacances_ecriture", { annee, message: error.message });
    }
    lignes = await lire(zone, annees);
  }

  return lignes.map((l) => ({
    // Identifiant stable et lisible : la clé unique de la table.
    id: `${l.annee_scolaire}|${l.zone}|${l.libelle}`,
    libelle: l.libelle,
    debut: l.debut,
    fin: l.fin,
  }));
}
