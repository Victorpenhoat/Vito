import { BookUser, IdCard, Car, Ship, Stamp, FileBadge, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  passeport: BookUser,
  carte_identite: IdCard,
  permis_conduire: Car,
  permis_bateau: Ship,
  visa: Stamp,
  titre_sejour: FileBadge,
  autre: FileText,
};

export function DocTypeIcon({ docType }: { docType: string }) {
  const Icon = ICONS[docType] ?? FileText;
  return (
    <span className="grid h-10 w-10 place-items-center rounded-[6px] bg-accent-50 text-accent">
      <Icon size={20} />
    </span>
  );
}
