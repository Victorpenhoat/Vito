import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { logActionError } from "@/lib/actionError";
import { createAdminClient } from "@/lib/supabase/admin";
import { signatureValide } from "@/lib/mail/signature";
import { statutDepuisEvenement, avance, statutsAnterieurs, type Statut } from "@/lib/mail/statut";

// Corps brut requis pour la vérif de signature → runtime nodejs (pas edge).
// Même patron que /api/stripe/webhook, éprouvé.
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!env.RESEND_WEBHOOK_SECRET) {
    // Refuser, jamais s'ouvrir : un webhook non configuré est une porte, pas un détail.
    logActionError("resend.webhook.misconfigured", new Error("RESEND_WEBHOOK_SECRET manquant"));
    return new Response("configuration Resend manquante", { status: 500 });
  }

  const corps = await request.text();
  const id = request.headers.get("svix-id") ?? "";
  const horodatage = request.headers.get("svix-timestamp") ?? "";
  const signature = request.headers.get("svix-signature") ?? "";

  if (!signatureValide(env.RESEND_WEBHOOK_SECRET, id, horodatage, corps, signature)) {
    log.warn("resend_webhook_signature");
    return new Response("signature invalide", { status: 400 });
  }

  let evenement: { type?: unknown; data?: { email_id?: unknown } };
  try {
    const analyse: unknown = JSON.parse(corps);
    // `JSON.parse("null")` réussit et rend `null` : sans ce garde-fou, la ligne
    // suivante lit `.type` dessus et jette hors du try/catch.
    if (typeof analyse !== "object" || analyse === null) {
      return new Response("corps illisible", { status: 400 });
    }
    evenement = analyse as { type?: unknown; data?: { email_id?: unknown } };
  } catch {
    return new Response("corps illisible", { status: 400 });
  }

  const nouveau = typeof evenement.type === "string" ? statutDepuisEvenement(evenement.type) : null;
  const fournisseurId = evenement.data?.email_id;
  if (!nouveau || typeof fournisseurId !== "string") {
    return new Response(null, { status: 200 }); // événement sans intérêt : accusé, ignoré
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("journal_envois")
      .select("id, statut")
      .eq("fournisseur_id", fournisseurId)
      .maybeSingle();

    // Un identifiant inconnu est IGNORÉ, jamais inséré : sans quoi qui sait
    // l'URL remplit la table.
    if (!data) {
      log.warn("resend_webhook_inconnu", { fournisseur_id: fournisseurId });
      return new Response(null, { status: 200 });
    }
    if (!avance(data.statut as Statut, nouveau)) return new Response(null, { status: 200 });

    // Le `avance()` ci-dessus évite un aller-retour inutile mais ne PROTÈGE rien :
    // deux webhooks concurrents (un rebond et une remise tardive, par ex.) peuvent
    // tous deux lire ce même statut avant l'écriture de l'autre, tous deux passer
    // leur propre `avance()`, puis s'écraser au hasard de l'ordre des UPDATE. La
    // correction tient dans le WHERE : la ligne n'est touchée que si son statut
    // est encore un de ceux qui précèdent `nouveau`, vérifié atomiquement par
    // Postgres au moment de l'écriture — pas par ce qu'on a lu plus tôt.
    await admin
      .from("journal_envois")
      .update({ statut: nouveau })
      .eq("id", data.id)
      .in("statut", statutsAnterieurs(nouveau));
  } catch (err) {
    logActionError("resend.webhook.maj", err);
    return new Response("erreur de mise à jour", { status: 500 }); // Resend rejouera
  }
  return new Response(null, { status: 200 });
}
