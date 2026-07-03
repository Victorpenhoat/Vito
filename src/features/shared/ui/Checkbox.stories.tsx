import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox } from "./Checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Kit/Checkbox",
  component: Checkbox,
  args: { label: "Avec vue" },
};
export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {};
export const Checked: Story = { args: { label: "En amoureux", defaultChecked: true } };
export const Disabled: Story = { args: { label: "Indisponible", disabled: true } };
export const Group: Story = {
  render: () => (
    <div className="flex flex-wrap gap-x-4">
      {["Avec vue", "En amoureux", "Cave à vins", "Terrasse"].map((l, i) => (
        <Checkbox key={l} label={l} defaultChecked={i % 2 === 0} />
      ))}
    </div>
  ),
};
