"use client";
import { useEffect } from "react";
import { ecouterLiensProfonds } from "@/lib/platform/liensProfonds";

// Les liens que le système remet à l'app.
//
// Le lien de connexion envoyé par e-mail pointe DIRECTEMENT sur notre domaine
// (`{{ .RedirectTo }}?token_hash=…`, cf. supabase/templates/magic_link.html),
// et c'est ce qui rend l'affaire possible : iOS ne suit pas les Universal Links
// à travers une redirection. Si le mail pointait d'abord sur Supabase, le lien
// finirait dans Safari et la session s'installerait à côté de l'app.
//
// Ici, iOS reconnaît le domaine, ouvre Vito, et nous remet l'URL : on la joue
// dans la WebView, qui est déjà sur ce domaine.
export function LiensProfonds() {
  useEffect(() => {
    let arreter: (() => void) | undefined;
    let annule = false;
    void ecouterLiensProfonds(window.location.origin, (chemin) => {
      // Navigation complète et non `router.push` : le retour du lien magique
      // passe par une route serveur qui POSE DES COOKIES et redirige. Une
      // navigation cliente ne les verrait pas s'installer.
      window.location.assign(chemin);
    }).then((stop) => {
      if (annule) stop();
      else arreter = stop;
    });
    return () => { annule = true; arreter?.(); };
  }, []);
  return null;
}
