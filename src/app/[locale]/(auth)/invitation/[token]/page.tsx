import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { lireInvitation } from "@/features/invitations/data/actions";
import { CreerCompteTunnel } from "@/features/invitations/ui/CreerCompteTunnel";
import { RejoindreVoyage } from "@/features/invitations/ui/RejoindreVoyage";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDay } from "@/lib/format/date";
import { getLocale } from "next-intl/server";

// Accueil de l'invité (design Onboarding écran 12) : qui invite, à quoi, et la
// création de compte. Un compte est TOUJOURS requis, même pour un voyage
// partagé — l'invité n'aura accès qu'à ce voyage.
//
// Lot F : celui qui a DÉJÀ un compte et une session ouverte rejoint d'un clic,
// au lieu de se voir proposer d'en créer un second.
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("invitations");
  const locale = await getLocale();
  const invitation = await lireInvitation(token);
  const supabase = await createServerSupabase();
  const { data: session } = await supabase.auth.getUser();

  if (!invitation.valide) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm rounded-card border border-line bg-surface p-7 text-center shadow-sm">
          <h1 className="font-serif text-xl text-ink">{t("invalide.titre")}</h1>
          <p data-testid="invitation-invalide" className="mt-2 text-sm text-muted">{t("invalide.texte")}</p>
          <Link href="/login" className="mt-4 inline-block text-[12.5px] font-semibold text-accent">
            {t("invalide.seConnecter")}
          </Link>
        </div>
      </main>
    );
  }

  const periode = invitation.voyage_date_debut && invitation.voyage_date_fin
    ? `${formatDay(invitation.voyage_date_debut, locale)} → ${formatDay(invitation.voyage_date_fin, locale)}`
    : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-7 shadow-sm">
        <div className="mb-5">
          <div className="text-[17px] font-bold tracking-[0.28em] text-ink">VITO</div>
          <div className="font-serif text-[13px] italic text-faint">{t("marqueSous")}</div>
        </div>

        <div data-testid="invitation-accueil" className="mb-5">
          <p className="text-sm text-ink">
            <b>{invitation.invite_par}</b> {t("vousInvite")}
          </p>
          {invitation.voyage_titre && (
            <div className="mt-2 rounded-[5px] border border-accent/25 bg-accent-50 px-3.5 py-2.5">
              <div className="font-serif text-lg text-ink">{invitation.voyage_titre}</div>
              {periode && <div className="text-[12px] text-muted">{periode}</div>}
              <p className="mt-1.5 text-[11.5px] text-muted">{t("accesLimite")}</p>
            </div>
          )}
        </div>

        {session.user ? (
          <RejoindreVoyage token={token} voyageTitre={invitation.voyage_titre ?? null} />
        ) : (
          <>
            <CreerCompteTunnel token={token}
              emailIndice={invitation.email_indice ?? null}
              emailImpose={invitation.email_impose === true} />
            {/* Déjà inscrit mais pas connecté : le dire, plutôt que de laisser
                créer un doublon de compte. */}
            <p className="mt-3 text-center text-[11.5px] text-muted">
              {t("dejaUnCompte")}{" "}
              <Link href="/login" data-testid="invitation-se-connecter" className="font-semibold text-accent hover:underline">
                {t("seConnecterPuisRouvrir")}
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
