import { getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { getLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";

// Inscription sur invitation (décision PO) : sans lien, on saisit son code.
// Aucun compte ne peut être créé sans jeton valide — l'API publique
// d'inscription est fermée côté Supabase.
export default async function InscriptionPage() {
  const t = await getTranslations("invitations");
  const locale = await getLocale();

  async function ouvrirInvitation(formData: FormData) {
    "use server";
    const code = String(formData.get("code") ?? "").trim();
    if (!code) return;
    redirect({ href: `/invitation/${encodeURIComponent(code)}`, locale });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-7 shadow-sm">
        <h1 className="font-serif text-xl text-ink">{t("surInvitation.titre")}</h1>
        <p className="mt-2 text-sm text-muted">{t("surInvitation.texte")}</p>
        <form action={ouvrirInvitation} data-testid="form-code-invitation" className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("surInvitation.code")}
            <input name="code" required data-testid="champ-code"
              className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
          </label>
          <button type="submit" className="rounded-control bg-accent px-4 py-2.5 font-semibold text-white">
            {t("continuer")}
          </button>
        </form>
        <Link href="/login" className="mt-4 inline-block text-[12.5px] text-muted hover:text-ink">
          {t("surInvitation.dejaCompte")}
        </Link>
      </div>
    </main>
  );
}
