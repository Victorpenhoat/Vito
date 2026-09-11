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

// Les deux tons côte à côte : la distinction n'est pas décorative, elle dit ce
// qui est à l'utilisateur et ce qui vient d'ailleurs.
export const DeuxTons: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <SectionLabel ton="accent" badge={2}>Mes favoris</SectionLabel>
      <SectionLabel badge="Google Places">Ailleurs</SectionLabel>
    </div>
  ),
};
