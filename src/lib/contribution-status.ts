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

/**
 * Montant comptabilisé dans les totaux / rapports : uniquement si payé et verrouillé.
 * Un déverrouillage retire donc immédiatement la somme du total de colonne.
 */
export function contributionCountedAmount(
  c: Contribution | undefined | null
): number {
  if (!c || !isContributionRecordLocked(c)) return 0;
  if (resolveContributionStatus(c) !== "paid") return 0;
  return c.amount > 0 ? c.amount : 0;
}

/** Statut affiché dans les compteurs d’en-tête : seulement les marquages verrouillés. */
export function resolveLockedContributionStatus(
  c: Contribution | undefined | null
): "none" | ContributionStatus {
  if (!c || !isContributionRecordLocked(c)) return "none";
  return resolveContributionStatus(c);
}
