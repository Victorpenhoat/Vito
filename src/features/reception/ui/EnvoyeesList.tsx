import { getFormatter, getTranslations } from "next-intl/server";
import { Send } from "lucide-react";
import type { Envoyee } from "../data/queries";

// « Ce que j'ai recommandé » (lot 3). Sans la suite donnée : refuser ne se
// notifie pas, et afficher un statut ici le notifierait par la bande.
export async function EnvoyeesList({ envoyees }: { envoyees: Envoyee[] }) {
  const t = await getTranslations("reception");
  const format = await getFormatter();
  if (envoyees.length === 0) return null;

  return (
    <section data-testid="reco-envoyees" className="flex flex-col gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("envoyees")}</h2>
      <ul className="flex flex-col">
        {envoyees.map((e) => (
          <li key={e.id} data-testid="reco-envoyee" className="flex items-center gap-2 border-b border-line-soft py-2">
            <Send size={12} className="shrink-0 text-faint" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{e.libelle}</span>
            <span className="shrink-0 text-[11.5px] text-muted">
              {t("a", { nom: e.aNom })} · {format.dateTime(new Date(e.creeLe), { dateStyle: "short" })}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[10.5px] text-faint">{t("envoyeesAide")}</p>
    </section>
  );
}
