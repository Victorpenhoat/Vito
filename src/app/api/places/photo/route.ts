import { NextResponse, type NextRequest } from "next/server";
import { getPlacesProvider } from "@/lib/services/places";

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref) return NextResponse.json({ error: "ref manquant" }, { status: 400 });

  // Largeur : défaut 800, bornée >0 et plafonnée (max documenté Google ~4800)
  // pour neutraliser w= / w=0 / w=-1 et les valeurs abusives.
  const wRaw = Number(request.nextUrl.searchParams.get("w") ?? "800");
  const width = Number.isFinite(wRaw) && wRaw > 0 ? Math.min(wRaw, 4800) : 800;

  const url = getPlacesProvider().photoUrl(ref, width);
  if (!url) return NextResponse.json({ error: "indisponible" }, { status: 404 });

  if (url.startsWith("data:")) return NextResponse.redirect(url);

  const upstream = await fetch(url);
  if (!upstream.ok) {
    await upstream.body?.cancel(); // libère la connexion amont sur erreur
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  // Streaming direct : les bytes ne sont jamais persistés (conformité ToS)
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
