import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Compass } from "lucide-react";
import { NavItem } from "./NavItem";

const meta: Meta<typeof NavItem> = {
  title: "Kit/NavItem",
  component: NavItem,
  args: { icon: <Compass size={18} />, label: "Découvrir", href: "/decouvrir" },
};
export default meta;
type Story = StoryObj<typeof NavItem>;

export const Active: Story = { args: { active: true } };
export const Inactive: Story = { args: { active: false } };
