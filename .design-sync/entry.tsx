// Barrel d'entrée pour design-sync : Vito est une app (pas un package), donc on
// expose ici les 18 primitives du kit pour que le converter les bundle dans
// window.VitoKit.* ET pour qu'esbuild + ts-morph détectent les exports.
// Imports RELATIFS (pas l'alias @/) : ts-morph (détection d'exports / props,
// cf. pkgJson.types) ne charge pas les paths tsconfig. esbuild résout le relatif
// directement, et les imports @/ INTERNES des composants passent par le plugin
// tsconfig-paths (cfg.tsconfig). Voir .design-sync/NOTES.md.
import "./process-shim"; // DOIT rester en premier (définit process avant next-intl via Fab/NavItem/Modal)
export { Button } from "../src/features/shared/ui/Button";
export { Input } from "../src/features/shared/ui/Input";
export { Select } from "../src/features/shared/ui/Select";
export { Avatar } from "../src/features/shared/ui/Avatar";
export { Badge } from "../src/features/shared/ui/Badge";
export { Card } from "../src/features/shared/ui/Card";
export { Tile } from "../src/features/shared/ui/Tile";
export { Toast } from "../src/features/shared/ui/Toast";
export { PageHeader } from "../src/features/shared/ui/PageHeader";
export { SectionLabel } from "../src/features/shared/ui/SectionLabel";
export { Skeleton } from "../src/features/shared/ui/Skeleton";
export { Fab } from "../src/features/shared/ui/Fab";
export { NavItem } from "../src/features/shared/ui/NavItem";
export { Modal } from "../src/features/shared/ui/Modal";
export { ThemeToggle } from "../src/features/shared/ui/ThemeToggle";
export { Checkbox } from "../src/features/shared/ui/Checkbox";
export { DateField } from "../src/features/shared/ui/DateField";
export { FileField } from "../src/features/shared/ui/FileField";
