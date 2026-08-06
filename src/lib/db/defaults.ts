import type { Settings } from "@/lib/types";

export const DEFAULT_SETTINGS: Settings = {
  interestRateMonthly: 0.1,
  interestRateExtra: 0.015,
  contributionMin: 500,
  contributionStandard: 2500,
  penaltyLateContribution: 100,
  penaltyAbsence: 500,
  loanWithdrawalFeeRate: 0.02,
  loanMaxDurationMonths: 2,
  maxMembers: 50,
  year: 2026,
  cashOpeningBalance: 0,
  organizationName: "Solidarité Plus",
};
