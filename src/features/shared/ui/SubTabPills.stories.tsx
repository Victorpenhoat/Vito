import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SubTabPills } from "./SubTabPills";

const meta: Meta<typeof SubTabPills> = { title: "Kit/SubTabPills", component: SubTabPills };
export default meta;
type Story = StoryObj<typeof SubTabPills>;

export const AvecCompteurs: Story = {
  render: () => (
    <SubTabPills ariaLabel="Vue" valeur="favoris" onChange={() => {}}
      options={[
        { cle: "favoris", libelle: "Favoris", compte: 8 },
        { cle: "a_tester", libelle: "À tester", compte: 12 },
      ]} />
  ),
};
