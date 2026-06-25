import { getTranslations, getFormatter } from "next-intl/server";
import { greeting } from "../greeting";

export async function HeroCard({ userName }: { userName: string }) {
  const t = await getTranslations("accueil");
  const format = await getFormatter();
  const mode = greeting(new Date().getHours());
  const firstName = userName.split(/[\s@]/)[0] || userName;
  return (
    <section data-testid="hero" className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        {format.dateTime(new Date(), { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <h1 className="font-serif text-3xl font-medium text-ink md:text-4xl">
        {t(`greeting.${mode}`)} {firstName}
      </h1>
      <p className="max-w-xl border-l-[3px] border-accent pl-4 font-serif italic text-muted">
        {t("quote")}
      </p>
    </section>
  );
}
