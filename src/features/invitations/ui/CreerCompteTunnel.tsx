"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { creerCompteAvecInvitation } from "../data/actions";

type Etape = 1 | 2 | 3;

// Création de compte sur invitation (design Onboarding, écrans 2, 5 et 7).
// Trois étapes reprenables : identité → profil → confidentialité. Les étapes
// passkey et verrouillage du design viendront s'insérer aux lots O-D et O-E.
export function CreerCompteTunnel({ token, emailIndice, emailImpose }: {
  token: string; emailIndice: string | null; emailImpose: boolean;
}) {
  const t = useTranslations("invitations");
  const ta = useTranslations("auth");
  const [etape, setEtape] = useState<Etape>(1);
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [state, action, pending] = useActionState(creerCompteAvecInvitation, undefined);

  const champ =
    "rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-transparent focus:outline-2 focus:outline-accent";
  const etape1Ok = email.includes("@") && motDePasse.length >= 8;
  const etape2Ok = prenom.trim().length > 0;

  return (
    <form action={action} data-testid="creer-compte-tunnel" className="flex flex-col gap-4 text-left">
      <input type="hidden" name="token" value={token} />
      {/* les valeurs des étapes précédentes voyagent avec le formulaire */}
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="password" value={motDePasse} />
      <input type="hidden" name="firstName" value={prenom} />
      <input type="hidden" name="lastName" value={nom} />

      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        {t("etape", { n: etape, total: 3 })}
      </div>

      {etape === 1 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-xl text-ink">{t("identite.titre")}</h2>
          {emailIndice && (
            <p className="text-[12.5px] text-muted">{t("identite.indice", { indice: emailIndice })}</p>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium">
            {ta("email")}
            <input type="email" required autoComplete="email" value={email} data-testid="compte-email"
              onChange={(e) => setEmail(e.target.value)} className={champ} />
          </label>
          {emailImpose && <p className="text-[11.5px] text-faint">{t("identite.emailImpose")}</p>}
          <label className="flex flex-col gap-1 text-sm font-medium">
            {ta("password")}
            <input type="password" required minLength={8} autoComplete="new-password" value={motDePasse}
              data-testid="compte-mot-de-passe" onChange={(e) => setMotDePasse(e.target.value)} className={champ} />
          </label>
          <p className="text-[11.5px] text-faint">{t("identite.motDePasseAide")}</p>
          <button type="button" disabled={!etape1Ok} data-testid="etape-suivante"
            onClick={() => setEtape(2)}
            className="rounded-control bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60">
            {t("continuer")}
          </button>
        </div>
      )}

      {etape === 2 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-xl text-ink">{t("profil.titre")}</h2>
          <p className="text-[12.5px] text-muted">{t("profil.fiche")}</p>
          <div className="flex gap-2.5">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              {t("profil.prenom")}
              <input required value={prenom} data-testid="compte-prenom"
                onChange={(e) => setPrenom(e.target.value)} className={champ} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              {t("profil.nom")}
              <input value={nom} data-testid="compte-nom"
                onChange={(e) => setNom(e.target.value)} className={champ} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEtape(1)} className="text-[12.5px] text-muted hover:text-ink">
              {t("retour")}
            </button>
            <button type="button" disabled={!etape2Ok} data-testid="etape-suivante" onClick={() => setEtape(3)}
              className="ml-auto rounded-control bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60">
              {t("continuer")}
            </button>
          </div>
        </div>
      )}

      {etape === 3 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-xl text-ink">{t("confidentialite.titre")}</h2>
          <div className="rounded-[5px] border border-line bg-surface px-3.5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("confidentialite.fait")}</div>
            <ul className="mt-1.5 flex flex-col gap-1 text-[12.5px] text-ink">
              <li>{t("confidentialite.conserve")}</li>
              <li>{t("confidentialite.heberge")}</li>
              <li>{t("confidentialite.documents")}</li>
            </ul>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("confidentialite.pasFait")}</div>
            <ul className="mt-1.5 flex flex-col gap-1 text-[12.5px] text-ink">
              <li>{t("confidentialite.pasPublicite")}</li>
              <li>{t("confidentialite.pasRevente")}</li>
              <li>{t("confidentialite.pasPartage")}</li>
            </ul>
          </div>
          {/* jamais pré-cochée : l'acceptation doit être un geste explicite */}
          <label className="flex items-start gap-2 text-[12.5px] text-ink">
            <input type="checkbox" name="conditions" value="on" required data-testid="compte-conditions" className="mt-0.5" />
            <span>{t("confidentialite.accepte")}</span>
          </label>
          {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEtape(2)} className="text-[12.5px] text-muted hover:text-ink">
              {t("retour")}
            </button>
            <button type="submit" disabled={pending} data-testid="creer-compte"
              className="ml-auto rounded-control bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60">
              {t("commencer")}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
