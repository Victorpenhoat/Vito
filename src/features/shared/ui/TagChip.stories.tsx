import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TagChip } from "./TagChip";

const meta: Meta<typeof TagChip> = { title: "Kit/TagChip", component: TagChip, args: { children: "Terrasse" } };
export default meta;
type Story = StoryObj<typeof TagChip>;

// Les huit états du canevas côte à côte : c'est le seul endroit où le survol
// et le focus se regardent.
export const TousLesEtats: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <TagChip>Terrasse</TagChip>
      <TagChip onClick={() => {}}>Terrasse</TagChip>
      <TagChip ton="selectionne" compte={11}>Terrasse</TagChip>
      <TagChip ton="actif-doux" onClick={() => {}}>Favori ✓</TagChip>
      <TagChip couleur="var(--color-kpi-green)">Valeur sûre</TagChip>
      <TagChip ton="vide" compte={0} onClick={() => {}}>Coréen</TagChip>
      <TagChip ton="ajout" onClick={() => {}}>+ Ajouter</TagChip>
      <TagChip ton="suggere" onClick={() => {}}>Occasion</TagChip>
      <TagChip onRetirer={() => {}} libelleRetrait="Retirer Terrasse">Terrasse</TagChip>
    </div>
  ),
};
