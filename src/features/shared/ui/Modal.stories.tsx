import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Modal } from "./Modal";

const meta: Meta<typeof Modal> = {
  title: "Kit/Modal",
  component: Modal,
  args: { onClose: () => {} },
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof Modal>;

export const Open: Story = {
  args: {
    open: true,
    title: "Confirmer la réservation",
    children: "Voulez-vous confirmer votre réservation pour ce soir ?",
  },
};
