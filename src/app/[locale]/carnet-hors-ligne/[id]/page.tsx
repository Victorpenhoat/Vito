import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatRange, formatDay } from "@/lib/format/date";
import { getVoyageDetail, getVoyageDocuments } from "@/features/voyages/data/queries";
import { parJour, estAffichable, cheminDocument, sejourEnCours } from "@/features/voyages/domain/horsLigne";

// Carnet de voyage emporté (design Onboarding_Compte écran 12).
//
// Cette page vit VOLONTAIREMENT hors du groupe (app) : pas de coquille, pas de
// verrouillage. Le verrou se lève avec le mot de passe, donc en vérifiant auprès
// du serveur — hors ligne, il enfermerait le voyageur dehors, à l'exact opposé
// de la promesse « consultables hors ligne, sans vérification ».
//
// Elle est mise en cache telle quelle par l'appareil. Ses styles sont donc
// écrits ICI, en repli des jetons de l'application : sans réseau, la feuille de
// styles de Next n'est pas forcément disponible, et un voucher illisible à la
// réception d'un hôtel ne vaut rien.

export default async function CarnetHorsLignePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const detail = await getVoyageDetail(id);
  if (!detail) notFound();
  const documents = await getVoyageDocuments(id);
  const t = await getTranslations("voyages");
  const { voyage, reservations } = detail;

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const enCours = sejourEnCours(voyage.date_debut, voyage.date_fin, aujourdhui);
  const dates = formatRange(voyage.date_debut, voyage.date_fin, locale) || voyage.periode_texte || "";
  const journees = parJour(reservations);

  return (
    <main className="carnet">
      <style>{CSS}</style>

      <header className="carnet-tete">
        <p className="carnet-kicker">{t("horsLigne.titre")}</p>
        <h1 className="carnet-titre">{voyage.titre}</h1>
        <p className="carnet-sous">{[voyage.destination, dates].filter(Boolean).join(" · ")}</p>
        <p className="carnet-mention" data-testid="carnet-mention">
          {enCours && voyage.destination
            ? t("horsLigne.actifPendant", { destination: voyage.destination })
            : t("horsLigne.consultableSansReseau")}
        </p>
      </header>

      <section className="carnet-bloc">
        <h2 className="carnet-h2">{t("reservations")}</h2>
        {journees.length === 0 ? (
          <p className="carnet-vide">{t("horsLigne.aucuneReservation")}</p>
        ) : (
          journees.map((jour) => (
            <div key={jour.date ?? "sans-date"} className="carnet-jour">
              <h3 className="carnet-h3">
                {jour.date ? formatDay(jour.date, locale) : t("horsLigne.sansDate")}
              </h3>
              <ul className="carnet-liste">
                {jour.items.map((r) => (
                  <li key={r.id} data-testid="carnet-reservation" className="carnet-item">
                    <span className="carnet-type">{t(`types.${r.type}`)}</span>
                    <span className="carnet-nom">
                      {[r.fournisseur, r.reference].filter(Boolean).join(" · ") || t(`types.${r.type}`)}
                    </span>
                    {(r.date_debut || r.date_fin) && (
                      <span className="carnet-detail">{formatRange(r.date_debut, r.date_fin, locale)}</span>
                    )}
                    {/* tel: et mailto: fonctionnent sans réseau de données */}
                    {r.conciergerie_tel && <a className="carnet-lien" href={`tel:${r.conciergerie_tel}`}>{r.conciergerie_tel}</a>}
                    {r.conciergerie_mail && <a className="carnet-lien" href={`mailto:${r.conciergerie_mail}`}>{r.conciergerie_mail}</a>}
                    {r.notes && <span className="carnet-detail">{r.notes}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="carnet-bloc">
        <h2 className="carnet-h2">{t("documents.titre")}</h2>
        {documents.length === 0 ? (
          <p className="carnet-vide">{t("horsLigne.aucunDocument")}</p>
        ) : (
          <ul className="carnet-liste">
            {documents.map((d) => (
              <li key={d.id} data-testid="carnet-document" className="carnet-item">
                <span className="carnet-nom">{d.nom}</span>
                {estAffichable(d.mime_type) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- pièce jointe servie par notre route (et par le cache hors ligne) : next/image la re-téléchargerait depuis le réseau
                  <img className="carnet-image" src={cheminDocument(d.id)} alt={d.nom} />
                ) : (
                  <a className="carnet-lien" href={cheminDocument(d.id)}>{t("horsLigne.ouvrirDocument")}</a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="carnet-pied">
        <p data-testid="carnet-identite">{t("horsLigne.identiteProtegee")}</p>
        <p className="carnet-faible">{t("horsLigne.surCetAppareil")}</p>
        <a className="carnet-lien" href={`/${locale}/voyages/${voyage.id}`}>{t("horsLigne.retourApplication")}</a>
      </footer>
    </main>
  );
}

// Repli des jetons de l'application, valeurs identiques à globals.css.
const CSS = `
.carnet { --c-app:#161310; --c-surface:#1E1A14; --c-ink:#F2EDE3; --c-muted:#A39A8A;
  --c-faint:#6E665A; --c-line:rgba(255,255,255,.08); --c-accent:#4F8BF0;
  background:var(--c-app); color:var(--c-ink); min-height:100dvh;
  margin:0 auto; max-width:44rem; padding:1.5rem 1.25rem 3rem;
  font-family:var(--font-inter,system-ui,-apple-system,sans-serif); font-size:14px; line-height:1.5; }
[data-theme="light"] .carnet { --c-app:#FBF9F3; --c-surface:#FFFFFF; --c-ink:#211E1A;
  --c-muted:#7A736A; --c-faint:#9A9081; --c-line:#E4DDD0; --c-accent:#2563EB; }
.carnet-tete { border-bottom:1px solid var(--c-line); padding-bottom:1rem; margin-bottom:1.25rem; }
.carnet-kicker { margin:0; font-size:10.5px; font-weight:600; letter-spacing:.12em;
  text-transform:uppercase; color:var(--c-faint); }
.carnet-titre { margin:.35rem 0 0; font-size:24px; font-weight:600;
  font-family:var(--font-newsreader,Georgia,serif); }
.carnet-sous { margin:.2rem 0 0; color:var(--c-muted); }
.carnet-mention { margin:.6rem 0 0; font-size:12.5px; color:var(--c-accent); }
.carnet-bloc { margin-bottom:1.75rem; }
.carnet-h2 { font-size:11px; font-weight:600; letter-spacing:.12em; text-transform:uppercase;
  color:var(--c-faint); margin:0 0 .6rem; }
.carnet-jour { margin-bottom:1rem; }
.carnet-h3 { font-size:13px; font-weight:600; margin:0 0 .35rem; color:var(--c-ink); }
.carnet-liste { list-style:none; margin:0; padding:0; }
.carnet-item { display:flex; flex-direction:column; gap:.15rem;
  border:1px solid var(--c-line); border-radius:5px; background:var(--c-surface);
  padding:.7rem .85rem; margin-bottom:.5rem; }
.carnet-type { font-size:10.5px; font-weight:600; letter-spacing:.14em;
  text-transform:uppercase; color:var(--c-accent); }
.carnet-nom { font-size:15px; }
.carnet-detail { font-size:12.5px; color:var(--c-muted); }
.carnet-lien { font-size:12.5px; color:var(--c-accent); text-decoration:none; }
.carnet-lien:hover { text-decoration:underline; }
.carnet-image { max-width:100%; height:auto; border-radius:4px; margin-top:.4rem; }
.carnet-vide { color:var(--c-muted); margin:0; }
.carnet-pied { border-top:1px solid var(--c-line); padding-top:1rem;
  display:flex; flex-direction:column; gap:.3rem; font-size:12.5px; }
.carnet-faible { color:var(--c-faint); margin:0; }
.carnet-pied p { margin:0; }
`;
