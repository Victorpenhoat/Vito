import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SearchField } from "./SearchField";

const meta: Meta<typeof SearchField> = { title: "Kit/SearchField", component: SearchField };
export default meta;
type Story = StoryObj<typeof SearchField>;

// Le survol et le focus ne se scriptent pas : ils se regardent ici.
export const QuatreEtats: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-2.5">
      <SearchField valeur="" onChange={() => {}} placeholder="Nom, ville, tag…" libelleEffacer="Effacer" />
      <SearchField valeur="coréen" onChange={() => {}} placeholder="Nom, ville, tag…" libelleEffacer="Effacer" />
      <SearchField valeur="" onChange={() => {}} placeholder="Hors connexion" libelleEffacer="Effacer" horsLigne />
    </div>
  ),
};
