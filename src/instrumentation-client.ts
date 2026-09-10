import { config } from "zod";

// Zod compile ses validateurs en JIT — et commence par TESTER si le navigateur
// l'y autorise, avec un `Function("")` enveloppé dans un try/catch. Sous notre
// CSP (`script-src` sans 'unsafe-eval'), l'appel lève, Zod bascule proprement
// sur son chemin interprété… mais le navigateur signale quand même la
// tentative. Chaque page embarquant Zod émettait donc une violation vers
// /api/csp-report — une fausse alerte, répétée, qui noyait les vraies.
//
// `jitless` saute la sonde. Le comportement ne change pas d'un iota : sous CSP
// le JIT était déjà refusé. On cesse seulement de le demander.
//
// CLIENT UNIQUEMENT, et c'est délibéré : il n'y a pas de CSP côté serveur, où
// le JIT fonctionne et sert à quelque chose. Poser ce réglage dans
// `instrumentation.ts` coûterait de la performance sans rien régler.
config({ jitless: true });
