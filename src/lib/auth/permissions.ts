import type { Role } from "@/lib/types";

/** Accès lecture à l’espace gestion. */
export const GESTION_ACCESS_ROLES: Role[] = [
  "SUPER_ADMIN",
  "GESTIONNAIRE",
  "GESTIONNAIRE_LECTURE",
];

/** Création / modification des données métier. */
export const GESTION_WRITE_ROLES: Role[] = ["SUPER_ADMIN", "GESTIONNAIRE"];

/** Peuvent confirmer un prêt (et futures actions de validation). */
export const LOAN_APPROVER_ROLES: Role[] = [
  "SUPER_ADMIN",
  "GESTIONNAIRE",
  "GESTIONNAIRE_LECTURE",
];

/** Comptent dans le quorum d’approbation d’un prêt. */
export const LOAN_QUORUM_ROLES: Role[] = ["GESTIONNAIRE", "GESTIONNAIRE_LECTURE"];

export function canAccessGestion(role: Role): boolean {
  return GESTION_ACCESS_ROLES.includes(role);
}

export function canWriteGestion(role: Role): boolean {
  return GESTION_WRITE_ROLES.includes(role);
}

export function canApproveLoans(role: Role): boolean {
  return LOAN_APPROVER_ROLES.includes(role);
}

export function isLoanQuorumRole(role: Role): boolean {
  return LOAN_QUORUM_ROLES.includes(role);
}

export function roleLabel(role: Role): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super admin";
    case "GESTIONNAIRE":
      return "Gestionnaire";
    case "GESTIONNAIRE_LECTURE":
      return "Gestionnaire lecture";
    case "MEMBRE":
      return "Membre";
    default:
      return role;
  }
}
