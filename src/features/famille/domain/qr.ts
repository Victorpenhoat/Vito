import qrcode from "qrcode-generator";

/**
 * Le QR n'encode qu'une URL : c'est l'appareil photo du téléphone qui le lit,
 * pas Vito. Rien à demander comme permission caméra, rien à embarquer comme
 * décodeur — et ça marche depuis n'importe quel téléphone, même sans l'app.
 */
export function urlLien(origine: string, locale: string, code: string): string {
  return `${origine.replace(/\/$/, "")}/${locale}/lier/${code}`;
}

/**
 * SVG sans dimension en pixels : la carte qui l'affiche décide de sa taille,
 * et le motif reste net à l'impression comme sur un écran de téléphone.
 * Correction « M » (~15 %) : le QR reste lisible sur un écran un peu sali.
 */
export function qrSvg(contenu: string): string {
  const qr = qrcode(0, "M");
  qr.addData(contenu);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
