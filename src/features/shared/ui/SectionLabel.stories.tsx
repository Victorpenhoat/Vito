import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Sparkles } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

const meta: Meta<typeof SectionLabel> = {
  title: "Kit/SectionLabel",
  component: SectionLabel,
  args: { children: "À proximité" },
};
export default meta;
type Story = StoryObj<typeof SectionLabel>;

export const WithIcon: Story = { args: { icon: <Sparkles size={14} /> } };
export const TextOnly: Story = {};
