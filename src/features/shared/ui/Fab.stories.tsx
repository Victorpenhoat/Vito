import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";
import { Fab } from "./Fab";

const meta: Meta<typeof Fab> = {
  title: "Kit/Fab",
  component: Fab,
  args: { icon: <Plus size={24} />, label: "Ajouter" },
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof Fab>;

export const AsLink: Story = { args: { href: "/restos/nouveau" } };
export const AsButton: Story = { args: { onClick: () => {} } };
