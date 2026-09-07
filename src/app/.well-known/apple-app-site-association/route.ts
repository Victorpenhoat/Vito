import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { appIdValide } from "@/lib/platform/appleAppId";

// Universal Links : le fichier qu'iOS va chercher pour savoir quelles URL de ce
// domaine appartiennent à l'app.
//
// Sans lui, le lien magique se termine dans SAFARI : la session s'installe
// dans le navigateur, et l'app reste déconnectée juste à côté. Avec lui, iOS
// remet l'URL à Vito, qui la traite dans sa propre WebView.
//
// Le chemin `.well-known` contient un point : le proxy d'internationalisation
// l'ignore (son matcher exclut `.*\..*`), la route répond donc telle quelle,
// sans redirection de langue — ce qu'iOS exige.
//
// APPLE_APP_ID vaut « <TeamID>.<bundleId> », par exemple
// « ABCDE12345.com.badakan.vito ». Tant qu'il n'est pas défini, on répond 404
// plutôt qu'un fichier à moitié juste : iOS met en cache ce qu'il télécharge,
// et un mauvais identifiant se paie en heures d'attente.
export const dynamic = "force-dynamic";

export async function GET() {
  // Absent OU mal formé : on ne sert rien. Un « Q7UGNF4Q22 » sans bundle ID
  // produirait un fichier syntaxiquement valide mais inutile, qu'iOS garderait
  // en cache sans jamais reconnaître l'app — et sans rien expliquer.
  const appId = env.APPLE_APP_ID;
  if (!appIdValide(appId)) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [appId],
            components: [
              // Le retour du lien magique — la raison d'être de tout ceci.
              { "/": "/api/auth/confirm", comment: "retour du lien de connexion" },
              // Une invitation ouverte depuis un e-mail atterrit dans l'app si
              // elle est installée, dans le navigateur sinon.
              { "/": "/*/invitation/*", comment: "invitation nominative" },
            ],
          },
        ],
      },
    },
    {
      headers: {
        // iOS n'accepte le fichier qu'en application/json, et le recharge peu
        // souvent : on lui interdit de le figer trop longtemps.
        "content-type": "application/json",
        "cache-control": "public, max-age=300",
      },
    },
  );
}
