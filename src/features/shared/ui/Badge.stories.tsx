import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Kit/Badge",
  component: Badge,
  args: { children: "Nouveau" },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
