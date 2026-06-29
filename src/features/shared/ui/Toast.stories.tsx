import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toast } from "./Toast";

const meta: Meta<typeof Toast> = {
  title: "Kit/Toast",
  component: Toast,
  args: { children: "Votre message a été enregistré." },
  argTypes: { type: { control: "select", options: ["info", "success", "error"] } },
};
export default meta;
type Story = StoryObj<typeof Toast>;

export const Info: Story = { args: { type: "info" } };
export const Success: Story = { args: { type: "success" } };
export const Error: Story = { args: { type: "error" } };
