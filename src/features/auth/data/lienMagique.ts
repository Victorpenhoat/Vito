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

/**
 * Ne rend RIEN et ne jette JAMAIS — et c'est une règle de sécurité, pas une
 * commodité : l'appelant doit répondre exactement la même chose que le compte
 * existe ou non. Une réponse qui varierait laisserait énumérer les comptes.
 */
export async function envoyerLienMagiqueA(email: string, origine: string): Promise<void> {
  try {
    const admin = createAdminClient();
    // `magiclink` échoue pour une adresse inconnue et ne crée AUCUN compte :
    // c'est l'équivalent de `shouldCreateUser: false`. L'inscription reste sur
    // invitation.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const jeton = data?.properties?.hashed_token;
    if (error || !jeton) {
      // Tracé, jamais montré : compte inconnu, quota atteint, service en panne.
      log.warn("lien_magique", { message: error?.message ?? "aucun jeton" });
      return;
    }

    const lien = `${origine}/api/auth/confirm?token_hash=${encodeURIComponent(jeton)}&type=email`;
    await envoyer({
      a: email,
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
