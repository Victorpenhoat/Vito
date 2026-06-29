import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageHeader } from "./PageHeader";
import { Button } from "./Button";

const meta: Meta<typeof PageHeader> = {
  title: "Kit/PageHeader",
  component: PageHeader,
  args: { title: "Mes restos" },
};
export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Full: Story = {
  args: {
    eyebrow: "Découvrir",
    title: "Mes restos",
    subtitle: "Vos adresses favorites, au même endroit.",
    action: <Button variant="primary">Ajouter</Button>,
  },
};
export const TitleOnly: Story = { args: { title: "Mes restos" } };
