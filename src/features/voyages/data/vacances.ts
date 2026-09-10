import "server-only";
import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVacancesProvider } from "@/lib/services/vacances";
import { log, errorContext } from "@/lib/log";
import { deduireZone } from "../domain/zoneScolaire";
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

/**
 * La zone du foyer : celle qu'on a ENREGISTRÉE, sinon celle que l'adresse
 * laisse déduire, sinon `null`.
 *
 * Deux écrans en dépendent — le planning des voyages et la semaine des
 * activités — et l'un d'eux annonce la zone à l'écran. La règle est donc
 * écrite ici une seule fois : dupliquée, elle finirait par différer, et les
 * deux écrans se contrediraient sur les mêmes vacances.
 *
 * `null` n'est pas une panne : c'est « je ne sais pas », et l'écran demande
 * alors plutôt que de deviner (cf. `deduireZone`).
 */
export async function getZoneDuFoyer(): Promise<string | null> {
  // Fail-safe anon (cf. #61/#63) : page et layout rendent en parallèle.
  const auth = await getCachedUser();
  if (!auth.user) return null;

  const supabase = await createServerSupabase();
  const { data: profil } = await supabase
    .from("profiles").select("zone_scolaire").eq("id", auth.user.id).maybeSingle();
  // Le choix explicite l'emporte, et dispense de lire l'adresse.
  if (profil?.zone_scolaire) return profil.zone_scolaire;

  // Adresse du foyer = adresse de la fiche « Moi » (la RLS borne déjà à
  // l'utilisateur, cf. la même lecture dans reglages/page.tsx).
  const { data: moi } = await supabase
    .from("family_members").select("address").eq("relation", "moi").maybeSingle();
  return deduireZone(moi?.address);
}
