import { Introuvable } from "@/features/shell/ui/Introuvable";

// 404 des `notFound()` appelés par les pages : fiche absente, ou fiche d'un
// autre compte. Rendue DANS le layout [locale], donc traduite, thémée, et
// nonçée — là où le 404 par défaut de Next était prérendu en statique, anglais
// et sans nonce, donc muet sous 'strict-dynamic'.
//
// À savoir : cette version de Next renvoie 200 (et non 404) dès que la réponse
// est en flux. C'est son comportement, pas une bavure de la page.
export default function NotFound() {
  return <Introuvable />;
}
