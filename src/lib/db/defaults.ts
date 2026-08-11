import type { Settings } from "@/lib/types";

export const DEFAULT_SETTINGS: Settings = {
  interestRateMonthly: 0.1,
  interestRateExtra: 0.15,
  contributionMin: 500,
  contributionStandard: 2500,
  penaltyLateContribution: 100,
  penaltyAbsence: 500,
  loanWithdrawalFeeRate: 0.02,
  loanMaxDurationMonths: 2,
  loanSecondWitnessThreshold: 20000,
  maxMembers: 50,
  year: 2026,
  cashOpeningBalance: 0,
  organizationName: "Solidarité Plus",
  requirePasswordToUnlockContribution: true,
  depositPhone1: "+2290161137853",
  depositName1: "AGBLE VIDEHOU VENAS",
  depositPhone2: "",
  depositName2: "",
};

/** Fusionne un document settings partiel avec les valeurs par défaut. */
export function resolveSettings(partial?: Partial<Settings> | null): Settings {
  return { ...DEFAULT_SETTINGS, ...(partial ?? {}) };
}
