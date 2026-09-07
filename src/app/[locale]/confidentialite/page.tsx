import type { Metadata } from "next";
import { Link } from "@/lib/i18n/routing";

// Politique de confidentialité — page PUBLIQUE.
//
// Elle vit hors des groupes (app) et (auth) : Apple exige une URL accessible
// sans compte, et le verrou de l'app ne doit pas l'enfermer derrière la
// connexion. Même raison que `carnet-hors-ligne`.
//
// Le texte est en français, quelle que soit la langue de l'interface. Traduire
// un texte juridique à la machine serait pire que ne pas le traduire : chaque
// version ferait foi, et personne ne les aurait relues.

export const metadata: Metadata = {
  title: "Confidentialité · Vito",
  description: "Ce que Vito enregistre, ce qu'il n'enregistre pas, et qui d'autre le voit.",
};

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@vito.app";

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-serif text-xl text-ink">{titre}</h2>
      <div className="flex flex-col gap-2 text-[14px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto flex w-full max-w-[680px] flex-col gap-7 p-5 pb-16 md:p-10">
      <header className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Vito</span>
        <h1 className="font-serif text-3xl text-ink">Confidentialité</h1>
        <p className="text-[14px] leading-relaxed text-muted">
          Vito est un carnet personnel : restaurants, hôtels, vins, voyages, proches. Ce que
          vous y écrivez vous appartient. Cette page dit ce qui est enregistré, ce qui ne
          l&apos;est pas, et qui d&apos;autre le voit.
        </p>
        <p className="text-[12px] text-faint">Dernière mise à jour : 6 septembre 2026.</p>
      </header>

      <Section titre="Ce que Vito enregistre">
        <p>
          <strong className="text-ink">Votre compte</strong> : adresse e-mail, nom
          d&apos;affichage si vous en donnez un, langue, et de quoi vous reconnaître à la
          connexion — mot de passe chiffré, clés d&apos;accès (passkeys), double
          authentification si vous l&apos;activez. La liste de vos appareils et sessions
          vous est montrée dans l&apos;app, et vous pouvez les révoquer.
        </p>
        <p>
          <strong className="text-ink">Votre carnet</strong> : les adresses que vous
          enregistrez, vos notes, vos photos, vos voyages et leurs dépenses, votre cave, et
          les proches que vous y ajoutez. C&apos;est le contenu de l&apos;app.
        </p>
        <p>
          <strong className="text-ink">Vos documents</strong> (pièces d&apos;identité d&apos;un
          proche, billets, tickets) sont <strong className="text-ink">chiffrés</strong> avant
          d&apos;être stockés, et ne sont déchiffrés que pour vous les rendre.
        </p>
      </Section>

      <Section titre="Ce que Vito n'enregistre pas">
        <p>
          <strong className="text-ink">Votre position.</strong> Elle est lue au moment où vous
          demandez « autour de moi », pour cadrer la carte. Elle n&apos;est ni enregistrée, ni
          envoyée ailleurs, ni rattachée à votre compte.
        </p>
        <p>
          <strong className="text-ink">Aucun suivi publicitaire.</strong> Pas de régie, pas
          d&apos;identifiant publicitaire, pas de profil revendu, pas de mesure d&apos;audience
          tierce. Vito ne gagne rien à savoir ce que vous faites ailleurs.
        </p>
      </Section>

      <Section titre="Qui d'autre voit quelque chose">
        <p>Vito s&apos;appuie sur quelques prestataires, chacun pour une tâche précise :</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li><strong className="text-ink">Supabase</strong> — la base de données et les comptes. C&apos;est là que vit le carnet.</li>
          <li><strong className="text-ink">Vercel</strong> — l&apos;hébergement du site et de l&apos;app.</li>
          <li><strong className="text-ink">Google Places</strong> — reçoit ce que vous cherchez quand vous ajoutez une adresse, pour la retrouver et l&apos;enrichir. Jamais votre identité.</li>
          <li><strong className="text-ink">Anthropic</strong> — reçoit une photo <em>quand vous le demandez</em> : le scan d&apos;un document à recopier, l&apos;étiquette d&apos;une bouteille à reconnaître. Rien n&apos;y part sans ce geste.</li>
          <li><strong className="text-ink">OpenStreetMap</strong> — fournit les fonds de carte ; votre navigateur les demande directement.</li>
          <li><strong className="text-ink">Stripe</strong> — si vous prenez un abonnement, c&apos;est lui qui traite le paiement. Vito ne voit jamais votre carte.</li>
          <li><strong className="text-ink">Sentry</strong> — reçoit les rapports d&apos;erreur technique, pour réparer ce qui casse.</li>
        </ul>
      </Section>

      <Section titre="Emporter ou effacer">
        <p>
          Vous pouvez <strong className="text-ink">exporter</strong> tout votre carnet depuis
          votre compte, et le <strong className="text-ink">supprimer</strong> — la suppression
          demande trois confirmations, parce qu&apos;elle est définitive. Elle efface le compte
          et ce qui s&apos;y rattache, sans copie de sauvegarde à part.
        </p>
        <p>
          Les données sont conservées tant que le compte existe. Vous pouvez aussi demander
          l&apos;accès, la rectification, l&apos;effacement ou la portabilité de vos données, et
          vous opposer à leur traitement, en écrivant à l&apos;adresse ci-dessous.
        </p>
      </Section>

      <Section titre="Nous écrire">
        <p>
          Une question, une demande, un doute : <a href={`mailto:${CONTACT}`} className="font-semibold text-accent hover:underline">{CONTACT}</a>.
        </p>
      </Section>

      <Link href="/" className="text-[13px] font-semibold text-accent hover:underline">← Retour à Vito</Link>
    </main>
  );
}
