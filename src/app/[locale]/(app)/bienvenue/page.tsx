import { getTranslations } from "next-intl/server";
import { UserPlus, Utensils, Plane } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { getMonProfil } from "@/features/compte/data/queries";

// Premier pas (design Onboarding écran 8) : trois entrées possibles, ignorable.
export default async function BienvenuePage() {
  const t = await getTranslations("invitations");
  const profil = await getMonProfil();
  const prenom = profil?.first_name ?? "";

  const pistes = [
    { cle: "cercle", href: "/famille", Icone: UserPlus },
    { cle: "resto", href: "/restos", Icone: Utensils },
    { cle: "voyage", href: "/voyages", Icone: Plane },
  ] as const;

  return (
    <main className="flex flex-col gap-6 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-medium text-ink">{t("bienvenue.titre", { prenom })}</h1>
          <p className="mt-1 text-sm text-muted">{t("bienvenue.texte")}</p>
        </div>
        <Link href="/accueil" data-testid="ignorer-premier-pas" className="shrink-0 text-[12.5px] text-muted hover:text-ink">
          {t("bienvenue.ignorer")}
        </Link>
      </div>
      <ul data-testid="premier-pas" className="flex flex-col gap-2.5">
        {pistes.map(({ cle, href, Icone }) => (
          <li key={cle}>
            <Link href={href}
              className="flex items-center gap-3 rounded-[5px] border border-line bg-surface px-3.5 py-3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent">
              <Icone size={18} className="shrink-0 text-accent" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[13.5px] text-ink">{t(`bienvenue.${cle}`)}</span>
                <span className="block text-[11.5px] text-faint">{t(`bienvenue.${cle}Sous`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
