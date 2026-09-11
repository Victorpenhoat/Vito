import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Kit/Button",
  component: Button,
  args: { children: "Réserver" },
  argTypes: { variant: { control: "select", options: ["primary", "ghost", "subtle"] } },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: "primary" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Subtle: Story = { args: { variant: "subtle" } };
export const Pending: Story = { args: { variant: "primary", pending: true } };

// Le survol, le focus et le PRESSÉ ne se scriptent pas dans une story : ils se
// regardent à la souris et au clavier sur cette planche. C'est le seul endroit
// du dépôt où les six états du canevas sont visibles côte à côte.
export const TousLesEtats: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <Button>Chercher</Button>
      <Button disabled>Chercher</Button>
      <Button pending>Chargement</Button>
      <Button variant="ghost">Chercher</Button>
      <Button variant="subtle">Chercher</Button>
    </div>
  ),
};
