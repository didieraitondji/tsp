import type { Contribution, ContributionStatus } from "@/lib/types";

/** true si la cellule est verrouillée (payé ou impayé marqué). */
export function isContributionRecordLocked(c: Contribution): boolean {
  if (c.locked === false) return false;
  if (c.status === "paid" || c.status === "unpaid") return true;
  return c.amount > 0;
}

export function resolveContributionStatus(
  c: Contribution | undefined | null
): "none" | ContributionStatus {
  if (!c) return "none";
  if (c.status === "unpaid") return "unpaid";
  if (c.status === "paid" || c.amount > 0) return "paid";
  return "none";
}
