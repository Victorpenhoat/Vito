import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ViewSwitcher } from "./ViewSwitcher";

const meta: Meta<typeof ViewSwitcher> = { title: "Kit/ViewSwitcher", component: ViewSwitcher };
export default meta;
type Story = StoryObj<typeof ViewSwitcher>;

export const DeuxVues: Story = {
  render: () => (
    <ViewSwitcher valeur="liste" onChange={() => {}}
      options={[
        { cle: "liste", icone: <span aria-hidden>☰</span>, libelle: "Liste" },
        { cle: "vignettes", icone: <span aria-hidden>▦</span>, libelle: "Vignettes" },
      ]} />
  ),
};
