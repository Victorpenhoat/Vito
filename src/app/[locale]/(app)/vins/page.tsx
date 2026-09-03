import { redirect } from "@/lib/i18n/routing";
import { getLocale } from "next-intl/server";

// « Mes vins » n'est plus une page à part : la Cave est le 6ᵉ sous-onglet de
// Restaurants (design Vins & Cave écran 5). On redirige plutôt que de laisser
// deux listes de vins vivre en parallèle — et les liens déjà partagés marchent.
export default async function VinsPage() {
  redirect({ href: "/restos?onglet=cave", locale: await getLocale() });
}
