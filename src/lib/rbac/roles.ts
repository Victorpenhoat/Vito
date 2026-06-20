export type AppRole = "client" | "agence" | "admin";

export type Permission =
  | "access:admin"
  | "access:app"
  | "create:voyage_pour_client";

const MATRIX: Record<AppRole, Permission[]> = {
  client: ["access:app"],
  agence: ["access:app", "create:voyage_pour_client"],
  admin: ["access:app", "access:admin", "create:voyage_pour_client"],
};

export function can(role: AppRole, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}
