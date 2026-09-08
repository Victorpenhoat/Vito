"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  activiteInputSchema, creneauInputSchema, statutActiviteSchema,
  paiementInputSchema, reglerPaiementSchema,
} from "../domain/schemas";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function ajouterActivite(_prev: unknown, formData: FormData) {
  const parsed = activiteInputSchema.safeParse({
    type: formData.get("type"),
    nom: formData.get("nom"),
    statut: formData.get("statut") || undefined,
    clubNom: formData.get("clubNom") ?? undefined,
    adresse: formData.get("adresse") ?? undefined,
    telephone: formData.get("telephone") ?? undefined,
    formuleSeances: formData.get("formuleSeances") || undefined,
    membres: formData.getAll("membres"),
  });
  if (!parsed.success) return { error: "Activité invalide" };
  const d = parsed.data;

  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };

  const { data: creee, error } = await supabase
    .from("activites")
    .insert({
      user_id: uid, type: d.type, nom: d.nom, statut: d.statut,
      club_nom: d.clubNom ?? null, adresse: d.adresse ?? null,
      telephone: d.telephone ?? null, formule_seances: d.formuleSeances ?? null,
    })
    .select("id")
    .single();
  if (error || !creee) { logActionError("activites.ajouter", error); return { error: "Ajout échoué" }; }

  if (d.membres.length > 0) {
    const { error: mErr } = await supabase
      .from("activite_membres")
      .insert(d.membres.map((membre_id) => ({ activite_id: creee.id, membre_id })));
    if (mErr) {
      logActionError("activites.ajouterMembres", mErr);
      // Une activité rattachée à personne ne se retrouve dans aucun groupe :
      // mieux vaut la retirer que la laisser invisible.
      await supabase.from("activites").delete().eq("id", creee.id);
      return { error: "Rattachement des membres échoué" };
    }
  }

  revalidatePath("/activites");
  return { ok: true as const, id: creee.id };
}

export async function ajouterCreneau(_prev: unknown, formData: FormData) {
  const parsed = creneauInputSchema.safeParse({
    activiteId: formData.get("activiteId"),
    jourSemaine: formData.get("jourSemaine"),
    heureDebut: formData.get("heureDebut"),
    heureFin: formData.get("heureFin"),
    lieuPrecision: formData.get("lieuPrecision") ?? undefined,
    intervenant: formData.get("intervenant") ?? undefined,
    deposePar: formData.get("deposePar") || undefined,
  });
  if (!parsed.success) return { error: "Créneau invalide" };
  const d = parsed.data;

  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };

  const { data: cree, error } = await supabase
    .from("activite_creneaux")
    .insert({
      activite_id: d.activiteId, jour_semaine: d.jourSemaine,
      heure_debut: d.heureDebut, heure_fin: d.heureFin,
      lieu_precision: d.lieuPrecision ?? null, intervenant: d.intervenant ?? null,
      // Null porte du sens : c'est le « dépose à définir » de la maquette.
      depose_par: d.deposePar ?? null,
    })
    .select("id")
    .single();
  if (error || !cree) { logActionError("activites.ajouterCreneau", error); return { error: "Ajout du créneau échoué" }; }

  revalidatePath(`/activites/${d.activiteId}`);
  revalidatePath("/activites");
  return { ok: true as const, id: cree.id };
}

export async function changerStatutActivite(_prev: unknown, formData: FormData) {
  const parsed = statutActiviteSchema.safeParse({
    activiteId: formData.get("activiteId"),
    statut: formData.get("statut"),
  });
  if (!parsed.success) return { error: "Statut invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };

  const { data, error } = await supabase
    .from("activites")
    .update({ statut: parsed.data.statut })
    .eq("id", parsed.data.activiteId)
    .select("id")
    .maybeSingle();
  if (error) { logActionError("activites.statut", error); return { error: "Changement de statut échoué" }; }
  // Aucune ligne touchée : la RLS a filtré. On ne dit pas si l'activité existe.
  if (!data) return { error: "Changement de statut échoué" };

  revalidatePath(`/activites/${parsed.data.activiteId}`);
  revalidatePath("/activites");
  return { ok: true as const };
}

export async function ajouterPaiement(_prev: unknown, formData: FormData) {
  const parsed = paiementInputSchema.safeParse({
    activiteId: formData.get("activiteId"),
    libelle: formData.get("libelle"),
    montantCents: formData.get("montant"),
    echeance: formData.get("echeance") || undefined,
    periodicite: formData.get("periodicite") || undefined,
    moyen: formData.get("moyen") || undefined,
  });
  if (!parsed.success) return { error: "Échéance invalide" };
  const d = parsed.data;

  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };

  const { data: cree, error } = await supabase.from("activite_paiements").insert({
    activite_id: d.activiteId,
    libelle: d.libelle,
    montant_cents: d.montantCents,
    echeance: d.echeance ?? null,
    periodicite: d.periodicite ?? null,
    moyen: d.moyen ?? null,
  }).select("id").single();
  if (error || !cree) { logActionError("activites.ajouterPaiement", error); return { error: "Ajout échoué" }; }

  revalidatePath(`/activites/${d.activiteId}`);
  // Les alertes et la pastille se recalculent depuis la base : rien à
  // invalider de plus, mais la barre vit dans la mise en page.
  revalidatePath("/activites/alertes");
  return { ok: true as const, id: cree.id };
}

/**
 * Marque une échéance réglée — ou la remet due, parce qu'on a pu cocher trop
 * vite. La date de règlement suit l'état : un paiement défait ne garde pas la
 * date d'un règlement qui n'a pas eu lieu.
 */
export async function reglerPaiement(_prev: unknown, formData: FormData) {
  const parsed = reglerPaiementSchema.safeParse({
    paiementId: formData.get("paiementId"),
    activiteId: formData.get("activiteId"),
    paye: formData.get("paye"),
  });
  if (!parsed.success) return { error: "Entrée invalide" };
  const { paiementId, activiteId, paye } = parsed.data;

  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };

  const { data, error } = await supabase
    .from("activite_paiements")
    .update(
      paye === "oui"
        ? { statut: "paye" as const, paye_le: new Date().toISOString().slice(0, 10) }
        : { statut: "du" as const, paye_le: null },
    )
    .eq("id", paiementId)
    .select("id")
    .maybeSingle();
  if (error) { logActionError("activites.reglerPaiement", error); return { error: "Mise à jour échouée" }; }
  // Aucune ligne : la RLS a filtré. On ne dit pas si l'échéance existe.
  if (!data) return { error: "Mise à jour échouée" };

  revalidatePath(`/activites/${activiteId}`);
  revalidatePath("/activites/alertes");
  return { ok: true as const };
}
