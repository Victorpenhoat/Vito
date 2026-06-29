import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "Kit/Card",
  component: Card,
  args: { children: "Contenu de la carte — texte de démonstration." },
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {};
