import { Home, Wine } from "lucide-react";
import { Button } from "@/features/shared/ui/Button";
import { Badge } from "@/features/shared/ui/Badge";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Tile } from "@/features/shared/ui/Tile";
import { NavItem } from "@/features/shared/ui/NavItem";
import { Avatar } from "@/features/shared/ui/Avatar";
import { Toast } from "@/features/shared/ui/Toast";
import { ThemeToggle } from "@/features/shared/ui/ThemeToggle";
import { UiKitDemo } from "./UiKitDemo";

export default function UiKitPage() {
  return (
    <main data-theme="dark" data-testid="ui-kit" className="min-h-dvh bg-app p-6 text-ink">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Kit UI — Vito</h1>
          <ThemeToggle />
        </div>

        <Card>
          <SectionLabel icon="🎛️">Boutons</SectionLabel>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primaire</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="subtle">Subtle</Button>
            <Badge>3</Badge>
          </div>
        </Card>

        <Card>
          <SectionLabel icon="📊">Tuiles KPI</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Tile tone="green" label="Sorties" value={12} />
            <Tile tone="blue" label="Nouveaux restos" value={4} />
            <Tile tone="amber" label="Vins goûtés" value={7} />
            <Tile tone="violet" label="Dépenses voyage" value="320 €" />
          </div>
        </Card>

        <Card>
          <SectionLabel icon="🧭">Navigation</SectionLabel>
          <NavItem icon={<Home size={18} />} label="Accueil" href="/restos" active />
          <NavItem icon={<Wine size={18} />} label="Mes vins" href="/vins" />
        </Card>

        <Card>
          <SectionLabel icon="👤">Avatar & Toasts</SectionLabel>
          <div className="flex items-center gap-3">
            <Avatar name="Victor Penhoat" />
            <Toast type="success">Enregistré avec succès</Toast>
          </div>
        </Card>

        <Card>
          <SectionLabel icon="🪟">Modale & FAB</SectionLabel>
          <UiKitDemo />
        </Card>
      </div>
    </main>
  );
}
