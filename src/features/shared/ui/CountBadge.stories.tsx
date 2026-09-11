import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CountBadge } from "./CountBadge";

const meta: Meta<typeof CountBadge> = {
  title: "Kit/CountBadge",
  component: CountBadge,
  args: { children: "12" },
  argTypes: { ton: { control: "select", options: ["accent", "alerte", "neutre"] } },
};
export default meta;
type Story = StoryObj<typeof CountBadge>;

export const Neutre: Story = {};
export const Accent: Story = { args: { ton: "accent", children: "2" } };
export const Alerte: Story = { args: { ton: "alerte", children: "4" } };

// Les trois tons côte à côte, comme le canevas les pose.
export const TousLesTons: Story = {
  render: () => (
    <div className="flex items-center gap-2.5">
      <CountBadge ton="accent">2</CountBadge>
      <CountBadge ton="alerte">4</CountBadge>
      <CountBadge>12</CountBadge>
    </div>
  ),
};
