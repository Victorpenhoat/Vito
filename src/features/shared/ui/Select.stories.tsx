import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Select } from "./Select";

const options = (
  <>
    <option value="ami">Ami</option>
    <option value="famille">Famille</option>
    <option value="collegue">Collègue</option>
  </>
);

const meta: Meta<typeof Select> = {
  title: "Kit/Select",
  component: Select,
  args: { children: options },
};
export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {};
export const WithLabel: Story = { args: { label: "Relation", defaultValue: "ami" } };
export const WithError: Story = {
  args: { label: "Relation", error: "Choisis une relation" },
};
export const Disabled: Story = { args: { label: "Relation", defaultValue: "ami", disabled: true } };
