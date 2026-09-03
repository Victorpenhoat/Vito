import { getTranslations } from "next-intl/server";
import { ConnexionPanel } from "@/features/auth/ui/ConnexionPanel";
import { signIn, envoyerLienMagique } from "@/features/auth/data/actions";

// Connexion (design Onboarding_Compte écran 9) : lien par email en principal,
// mot de passe en repli. Un message neutre s'affiche si le lien a expiré — il ne
// dit jamais si un compte existe.
export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ lien?: string }>;
}) {
  const t = await getTranslations("auth");
  const { lien } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-7 shadow-sm">
        <div className="mb-5">
          <div className="text-[17px] font-bold tracking-[0.28em] text-ink">VITO</div>
          <div className="font-serif text-[13px] italic text-faint">{t("marqueSous")}</div>
        </div>
        {lien && (
          <p role="alert" data-testid="lien-invalide" className="mb-3 rounded-[5px] border border-current/20 bg-kpi-amber-bg px-3 py-2 text-[12.5px] text-kpi-amber">
            {t("lienExpire")}
          </p>
        )}
        <ConnexionPanel signIn={signIn} envoyerLienMagique={envoyerLienMagique} />
      </div>
    </main>
  );
}
