import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./options";
import {
  canAccessGestion,
  canAccessMembreSpace,
  canWriteGestion,
  GESTION_ACCESS_ROLES,
  GESTION_WRITE_ROLES,
  LOAN_APPROVER_ROLES,
} from "./permissions";
import type { Role } from "@/lib/types";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    redirect(homeForRole(session.user.role));
  }
  return session;
}

export async function requireMembreAccess() {
  const session = await requireSession();
  if (!canAccessMembreSpace(session.user.role, session.user.memberId)) {
    redirect(homeForRole(session.user.role));
  }
  return session;
}

export async function requireGestionAccess() {
  return requireRole(GESTION_ACCESS_ROLES);
}

export async function requireGestionWrite() {
  return requireRole(GESTION_WRITE_ROLES);
}

export async function requireLoanApprover() {
  return requireRole(LOAN_APPROVER_ROLES);
}

export function homeForRole(role: Role): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "GESTIONNAIRE":
    case "GESTIONNAIRE_LECTURE":
      return "/gestion";
    case "MEMBRE":
      return "/membre";
    default:
      return "/login";
  }
}

/** @deprecated préférer canWriteGestion */
export function canManage(role: Role): boolean {
  return canWriteGestion(role);
}

export { canAccessGestion, canAccessMembreSpace, canWriteGestion };
