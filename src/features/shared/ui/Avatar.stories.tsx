import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Avatar } from "./Avatar";

const meta: Meta<typeof Avatar> = {
  title: "Kit/Avatar",
  component: Avatar,
  args: { name: "Victor Penhoat" },
  argTypes: { size: { control: "select", options: ["sm", "md", "lg", "xl"] } },
};
export default meta;
type Story = StoryObj<typeof Avatar>;

export const Sm: Story = { args: { size: "sm" } };
export const Md: Story = { args: { size: "md" } };
export const Lg: Story = { args: { size: "lg" } };
export const Xl: Story = { args: { size: "xl" } };
export const CustomColor: Story = { args: { size: "lg", color: "#C2410C" } };
