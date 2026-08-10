import { todayIsoLocal } from "@/lib/cotisations-report";

export type MembreSessionStatus =
  | "valide"
  | "paye_avance"
  | "impaye"
  | "a_venir";

export function resolveMembreSessionStatus(
  weekDate: string,
  paid: boolean,
  todayIso: string = todayIsoLocal()
): MembreSessionStatus {
  if (paid) {
    return weekDate > todayIso ? "paye_avance" : "valide";
  }
  return weekDate > todayIso ? "a_venir" : "impaye";
}
