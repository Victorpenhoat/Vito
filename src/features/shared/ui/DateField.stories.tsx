import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DateField } from "./DateField";

const meta: Meta<typeof DateField> = {
  title: "Kit/DateField",
  component: DateField,
};
export default meta;
type Story = StoryObj<typeof DateField>;

export const Default: Story = {};
export const WithLabel: Story = { args: { label: "Date de visite", defaultValue: "2026-09-12" } };
export const WithError: Story = { args: { label: "Date de fin", error: "La fin doit suivre le début" } };
export const Disabled: Story = { args: { label: "Date", disabled: true } };
