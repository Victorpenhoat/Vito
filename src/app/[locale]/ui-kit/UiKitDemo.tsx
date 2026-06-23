"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/features/shared/ui/Button";
import { Modal } from "@/features/shared/ui/Modal";
import { Fab } from "@/features/shared/ui/Fab";

export function UiKitDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => setOpen(true)}>Ouvrir la modale</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Exemple de modale">
        <p className="text-sm text-muted">Contenu de démonstration.</p>
      </Modal>
      <Fab icon={<Plus size={22} />} label="Action rapide" onClick={() => setOpen(true)} />
    </div>
  );
}
