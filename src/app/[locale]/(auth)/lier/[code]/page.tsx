import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { lireLien } from "@/features/famille/data/lienActions";
import { AccepterLien } from "@/features/famille/ui/AccepterLien";
import { createServerSupabase } from "@/lib/supabase/server";

// Ce qu'ouvre le QR. Hors du groupe (app) — comme /invitation/[token] : la garde
// de rôle renverrait au login SANS retour possible, et le code serait perdu.
export default async function LierAvecCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const t = await getTranslations("famille.lien");

  const supabase = await createServerSupabase();
  const { data: session } = await supabase.auth.getUser();
  // `lien_infos` est réservée aux comptes connectés : sans session, on ne dit
  // rien du code — on demande d'abord de se connecter.
  const infos = session.user ? await lireLien(code) : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-7 shadow-sm">
        <div className="mb-5">
          <div className="text-[17px] font-bold tracking-[0.28em] text-ink">VITO</div>
          <div className="font-serif text-[13px] italic text-faint">{t("titre")}</div>
        </div>

        {!session.user ? (
          <>
            <p data-testid="lier-connexion" className="text-sm text-ink">{t("connexion")}</p>
            <Link href="/login" className="mt-4 inline-block text-[12.5px] font-semibold text-accent">
              {t("seConnecter")}
            </Link>
          </>
        ) : !infos?.valide ? (
          <>
            <h1 className="font-serif text-xl text-ink">{t("invalide")}</h1>
            <p data-testid="lier-invalide" className="mt-2 text-sm text-muted">{t("invalideTexte")}</p>
            <Link href="/famille" className="mt-4 inline-block text-[12.5px] font-semibold text-accent">
              {t("retour")}
            </Link>
          </>
        ) : infos.soi_meme ? (
          <>
            <p data-testid="lier-soi-meme" className="text-sm text-ink">{t("soiMeme")}</p>
            <Link href="/famille" className="mt-4 inline-block text-[12.5px] font-semibold text-accent">
              {t("retour")}
            </Link>
          </>
        ) : (
          <>
            <p data-testid="lier-accueil" className="text-sm text-ink">
              {t("vousPropose", { nom: infos.invite_par })}
            </p>
            <p className="mt-2 mb-5 text-[12px] text-muted">{t("explication")}</p>
            <AccepterLien code={code} relationProposee={infos.relation_proposee} />
          </>
        )}
      </div>
    </main>
  );
}
