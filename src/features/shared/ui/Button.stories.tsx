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
