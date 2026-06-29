import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tile } from "./Tile";

const meta: Meta<typeof Tile> = {
  title: "Kit/Tile",
  component: Tile,
  args: { label: "Réservations", value: 128 },
  argTypes: { tone: { control: "select", options: ["green", "blue", "amber", "violet"] } },
};
export default meta;
type Story = StoryObj<typeof Tile>;

export const Green: Story = { args: { tone: "green" } };
export const Blue: Story = { args: { tone: "blue" } };
export const Amber: Story = { args: { tone: "amber" } };
export const Violet: Story = { args: { tone: "violet" } };
