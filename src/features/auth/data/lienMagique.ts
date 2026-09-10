import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { envoyer } from "@/lib/mail/envoyer";
import { log } from "@/lib/log";

// Le lien magique, généré par l'Admin API et envoyé par NOTRE voie — GoTrue
// n'envoie plus rien. C'est ce qui rend traçable le message le plus fréquent de
// la plateforme, celui dont on nous dira qu'il n'arrive pas.
//
// Le corps reste le HTML nu d'aujourd'hui (repris de
// supabase/templates/magic_link.html) : ce lot déplace la voie, le lot 2 lui
// donnera l'allure de Vito.
//
// ATTENTION, fait vérifié contre l'API (et le comportement mesuré en local) :
// `generateLink` CRÉE le compte pour `type: 'magiclink'`, tout comme pour
// 'signup' et 'invite' — c'est une opération privilégiée qui contourne
// délibérément `enable_signup = false`. On ne peut donc PAS l'appeler pour
// savoir si un compte existe : il faut le savoir AVANT, via compte_existe()
// (migration 00062), qui répond sans jamais créer quoi que ce soit.

/**
 * Ne rend RIEN et ne jette JAMAIS — et c'est une règle de sécurité, pas une
 * commodité : l'appelant doit répondre exactement la même chose que le compte
 * existe ou non. Une réponse qui varierait laisserait énumérer les comptes.
 */
export async function envoyerLienMagiqueA(email: string, origine: string): Promise<void> {
  try {
    // Normalisée une fois pour toutes : `compte_existe` compare déjà en
    // minuscules, GoTrue stocke en minuscules, et le compteur ci-dessous ne
    // doit pas se laisser contourner par un `Foo@` puis un `foo@`.
    const adresse = email.trim().toLowerCase();
    const admin = createAdminClient();
    // Vérifié AVANT tout appel à generateLink — jamais après : generateLink
    // créerait le compte, ce que l'inscription sur invitation interdit.
    const { data: existe, error: erreurExistence } = await admin.rpc("compte_existe", {
      p_email: adresse,
    });
    if (erreurExistence || !existe) {
      // Tracé, jamais montré : compte inconnu (le cas normal ici), ou souci
      // technique sur la sonde elle-même.
      log.warn("lien_magique", { message: erreurExistence?.message ?? "compte inconnu" });
      return;
    }

    if (!(await sousLaLimite(admin, adresse))) return;

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: adresse,
    });
    const jeton = data?.properties?.hashed_token;
    if (error || !jeton) {
      // Tracé, jamais montré : quota atteint, service en panne — le compte,
      // lui, est déjà confirmé existant à ce stade.
      log.warn("lien_magique", { message: error?.message ?? "aucun jeton" });
      return;
    }

    const lien = `${origine}/api/auth/confirm?token_hash=${encodeURIComponent(jeton)}&type=email`;
    await envoyer({
      a: adresse,
      genre: "lien_magique",
      userId: data?.user?.id,
      sujet: "Votre lien de connexion à Vito",
      html:
        `<h2>Votre lien de connexion</h2>` +
        `<p>Bonjour,</p>` +
        `<p>Ouvrez ce lien pour vous connecter à Vito. Il est valable 15 minutes et ne fonctionne qu'une fois.</p>` +
        `<p><a href="${lien}">Se connecter à Vito</a></p>` +
        `<p>Si vous n'avez pas demandé ce lien, ignorez ce message : personne ne peut accéder à votre carnet sans l'ouvrir.</p>`,
      texte:
        `Votre lien de connexion à Vito.\n\n${lien}\n\n` +
        `Valable 15 minutes, utilisable une seule fois. ` +
        `Si vous n'avez pas demandé ce lien, ignorez ce message.`,
    });
  } catch (err) {
    log.warn("lien_magique", { message: err instanceof Error ? err.message : String(err) });
  }
}

// Limitation de débit du lien magique.
//
// Elle manquait, et son absence n'était pas un oubli de plus : tant que GoTrue
// envoyait, il appliquait `rate_limit_email_sent` et un intervalle minimum par
// adresse. `generateLink` est une opération d'administration, qui les contourne
// délibérément — en passant par notre voie, nous avons donc RETIRÉ le seul
// garde-fou existant. Ce qui restait (un compte à rebours sur le bouton
// « renvoyer ») est du navigateur, c'est-à-dire rien.
//
// Ce qui est en jeu est celui de l'ADR 0002 : l'argent et les tiers. Chaque
// demande est un appel facturé chez Resend, et une adresse connue peut être
// bombardée sans limite par qui la connaît.
//
// `consommerQuota` (ADR 0002) ne peut pas servir ici : il tire l'identité
// d'`auth.uid()`, absente par construction — la demande est anonyme, c'est tout
// son objet. Le compteur est donc le journal lui-même : `envoyer()` y écrit une
// ligne AVANT de partir, si bien que compter les lignes revient à compter les
// envois, sans table ni compteur supplémentaire.
/**
 * Cinq, et non trois, pour une raison qui n'a rien à voir avec l'abus : la CI
 * rejoue un test échoué deux fois (`retries: 2`), et le parcours du lien
 * magique demande un lien à chaque tentative. À trois, la limite valait
 * exactement le budget de retries — tout passait, mais la marge était nulle, et
 * le jour où elle serait franchie l'échec se lirait « aucun message reçu »,
 * c'est-à-dire comme une panne d'envoi plutôt que comme un refus de débit.
 * Cinq laisse deux tentatives de marge sans rien céder sur le bombardement.
 *
 * Exportée pour que le test dérive d'elle : deux nombres qui doivent s'accorder
 * finissent par diverger.
 */
export const LIMITE_LIENS = 5;
const FENETRE_MINUTES = 15;

/**
 * Cinq liens par quart d'heure et par adresse. Le lien vaut 15 minutes : au
 * cinquième, ce n'est plus quelqu'un qui n'a rien reçu, c'est une boucle ou un
 * bombardement. Le refus est SILENCIEUX — l'appelante répond exactement la même
 * chose dans tous les cas, et une erreur visible ici dirait à l'attaquant qu'il
 * a trouvé une adresse connue.
 *
 * **Refuse en cas d'erreur**, comme `consommerQuota` : un limiteur qui s'ouvre
 * quand la base tousse n'en est pas un.
 */
async function sousLaLimite(
  admin: ReturnType<typeof createAdminClient>,
  adresse: string,
): Promise<boolean> {
  const depuis = new Date(Date.now() - FENETRE_MINUTES * 60_000).toISOString();
  const { count, error } = await admin
    .from("journal_envois")
    .select("id", { count: "exact", head: true })
    .eq("destinataire", adresse)
    .eq("genre", "lien_magique")
    .gte("created_at", depuis);
  if (error) {
    log.warn("lien_magique", { message: "limiteur indisponible" });
    return false;
  }
  if ((count ?? 0) >= LIMITE_LIENS) {
    // Jamais l'adresse : le journal dit qu'un garde-fou a mordu, pas qui
    // passait devant (même règle que `quota_indisponible`).
    log.warn("lien_magique", { message: "debit depasse" });
    return false;
  }
  return true;
}
