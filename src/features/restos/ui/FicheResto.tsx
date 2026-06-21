import { getTranslations } from "next-intl/server";
import { getFiche, getTags } from "../data/queries";
import { FavoriteToggle } from "./FavoriteToggle";
import { AvisForm } from "./AvisForm";
import { TagPicker } from "./TagPicker";

export async function FicheResto({ etablissementId }: { etablissementId: string }) {
  const t = await getTranslations("restos");
  const [{ etab, item, avis, appliedTagIds }, tags] = await Promise.all([
    getFiche(etablissementId),
    getTags(),
  ]);
  if (!etab) return <p>{t("notFound")}</p>;
  return (
    <article className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">{etab.nom}</h1>
        <p className="text-gray-600">{etab.type} — {etab.adresse} {etab.arrondissement ?? ""}</p>
        {etab.telephone && <p>{etab.telephone}</p>}
      </header>
      {item && <FavoriteToggle listeItemId={item.id} isFavorite={item.is_favorite} />}
      {item && tags.length > 0 && (
        <TagPicker tags={tags} appliedTagIds={appliedTagIds} listeItemId={item.id} />
      )}
      <section>
        <h2 className="font-semibold">{t("avis")}</h2>
        <ul>{avis.map((a) => <li key={a.id} className="border-b py-1">{a.note ? `${a.note}/5 — ` : ""}{a.commentaire}</li>)}</ul>
        <AvisForm etablissementId={etab.id} />
      </section>
    </article>
  );
}
