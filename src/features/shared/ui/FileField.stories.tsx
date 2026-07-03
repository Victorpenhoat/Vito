import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FileField } from "./FileField";

const meta: Meta<typeof FileField> = {
  title: "Kit/FileField",
  component: FileField,
  args: { label: "Choisir un fichier", emptyLabel: "Aucun fichier sélectionné", name: "file" },
};
export default meta;
type Story = StoryObj<typeof FileField>;

export const Default: Story = {};
export const AcceptPdf: Story = { args: { accept: ".pdf" } };
