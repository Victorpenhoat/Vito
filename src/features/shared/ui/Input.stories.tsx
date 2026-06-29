import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Kit/Input",
  component: Input,
  args: { placeholder: "Votre email" },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const WithLabel: Story = { args: { label: "Email", placeholder: "vous@exemple.fr" } };
export const WithError: Story = {
  args: { label: "Email", defaultValue: "pas-un-email", error: "Adresse e-mail invalide" },
};
export const Disabled: Story = { args: { label: "Email", placeholder: "vous@exemple.fr", disabled: true } };
