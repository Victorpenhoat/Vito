import { getLocale, getTranslations } from "next-intl/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "@/lib/i18n/routing";
import { signIn, signUp } from "@/features/auth/data/actions";
import { AuthPanel } from "@/features/auth/ui/AuthPanel";

export default async function Home() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const locale = await getLocale();
    redirect({ href: "/accueil", locale });
  }
  const t = await getTranslations("app");
  return (
    <main
      data-testid="landing"
      className="flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(1200px_400px_at_50%_-10%,var(--color-accent-50),var(--color-canvas)_60%)] px-6 py-16"
    >
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-7 text-center shadow-sm">
        <div className="text-3xl font-extrabold tracking-tight">
          {t("name")}
          <span className="text-accent">.</span>
        </div>
        <p className="mb-6 mt-1.5 text-sm text-muted">{t("tagline")}</p>
        <AuthPanel signIn={signIn} signUp={signUp} />
      </div>
    </main>
  );
}
