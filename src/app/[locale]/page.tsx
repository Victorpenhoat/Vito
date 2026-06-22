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
    redirect({ href: "/restos", locale });
  }
  const t = await getTranslations("app");
  return (
    <main
      data-testid="landing"
      className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-black min-h-dvh"
    >
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {t("name")}
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t("tagline")}</p>
      </div>
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm dark:bg-zinc-900">
        <AuthPanel signIn={signIn} signUp={signUp} />
      </div>
    </main>
  );
}
