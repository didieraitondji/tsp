import { v4 as uuid } from "uuid";
import type {
  CashEntry,
  Contribution,
  EnrolledMember,
  Loan,
  Member,
  Penalty,
  Period,
  Repayment,
  Settings,
} from "@/lib/types";
import {
  cashbookRepo,
  contributionsRepo,
  listEnrolledForPeriod,
  loansRepo,
  membersRepo,
  penaltiesRepo,
  repaymentsRepo,
  settingsRepo,
  weeksRepo,
} from "./collections";
import { DEFAULT_SETTINGS } from "./defaults";
import {
  readCollectionForPeriodId,
  readMeta,
  readObjectForPeriodId,
  writeCollectionForPeriod,
} from "./store";

export function newId(prefix?: string): string {
  const id = uuid();
  return prefix ? `${prefix}-${id.slice(0, 8)}` : id;
}

export function memberDisplayName(m: Pick<Member, "lastName" | "firstName">): string {
  return `${m.lastName} ${m.firstName}`.trim();
}

export function computeLoanFigures(
  amount: number,
  settings: Settings
): {
  withdrawalFee: number;
  interestMonth1: number;
  interestMonth2: number;
  totalDue: number;
} {
  const withdrawalFee = Math.round(amount * settings.loanWithdrawalFeeRate);
  const interestMonth1 = Math.round(amount * settings.interestRateMonthly);
  const interestMonth2 = Math.round(amount * settings.interestRateMonthly);
  const totalDue = amount + interestMonth1 + interestMonth2;
  return { withdrawalFee, interestMonth1, interestMonth2, totalDue };
}

export function loanRemaining(loan: Loan): number {
  return Math.max(0, loan.totalDue - loan.repaid);
}

export async function getMemberBalance(memberId: string) {
  const [contributions, loans, penalties] = await Promise.all([
    contributionsRepo.all(),
    loansRepo.all(),
    penaltiesRepo.all(),
  ]);

  const totalContributed = contributions
    .filter((c) => c.memberId === memberId)
    .reduce((s, c) => s + c.amount, 0);

  const penaltiesDue = penalties
    .filter((p) => p.memberId === memberId && !p.paid)
    .reduce((s, p) => s + p.amount, 0);

  const loansOutstanding = loans
    .filter((l) => l.memberId === memberId && l.status !== "Remboursé")
    .reduce((s, l) => s + loanRemaining(l), 0);

  return {
    totalContributed,
    penaltiesDue,
    loansOutstanding,
    netBalance: totalContributed - penaltiesDue - loansOutstanding,
  };
}

export async function getDashboardStats(periodId?: string) {
  const empty = {
    cashBalance: 0,
    totalContributions: 0,
    totalLoans: 0,
    totalInterest: 0,
    activeMembers: 0,
    interestRate: DEFAULT_SETTINGS.interestRateMonthly,
    unpaidPenalties: 0,
    loansDue: 0,
  };

  let resolvedPeriodId = periodId?.trim() || "";
  if (!resolvedPeriodId) {
    const meta = await readMeta();
    resolvedPeriodId = meta.periods[0]?.id || "";
  }
  if (!resolvedPeriodId) return empty;

  // Rattrapage des cotisations déjà saisies sans écriture caisse
  await reconcileContributionCashEntries(resolvedPeriodId);

  const [settings, members, contributions, loans, penalties, cashbook] = await Promise.all([
    readObjectForPeriodId(resolvedPeriodId, "settings", DEFAULT_SETTINGS),
    listEnrolledForPeriod(resolvedPeriodId),
    readCollectionForPeriodId<Contribution>(resolvedPeriodId, "contributions"),
    readCollectionForPeriodId<Loan>(resolvedPeriodId, "loans"),
    readCollectionForPeriodId<Penalty>(resolvedPeriodId, "penalties"),
    readCollectionForPeriodId<CashEntry>(resolvedPeriodId, "cashbook"),
  ]);

  const disbursedLoans = loans.filter(
    (l) => l.status !== "En attente" && l.status !== "Refusé"
  );
  const totalContributions = contributions.reduce((s, c) => s + c.amount, 0);
  const totalLoans = disbursedLoans.reduce((s, l) => s + l.amount, 0);
  const totalInterest = disbursedLoans.reduce(
    (s, l) => s + l.interestMonth1 + l.interestMonth2 + l.interestExtra,
    0
  );
  const unpaidPenalties = penalties
    .filter((p) => !p.paid)
    .reduce((s, p) => s + p.amount, 0);
  const loansDue = loans
    .filter((l) => l.status === "En cours" || l.status === "En retard")
    .reduce((s, l) => s + loanRemaining(l), 0);

  const cashBalance = computeCashBalance(cashbook, settings.cashOpeningBalance);

  return {
    cashBalance,
    totalContributions,
    totalLoans,
    totalInterest,
    activeMembers: members.filter((m) => m.status === "Actif").length,
    interestRate: settings.interestRateMonthly,
    unpaidPenalties,
    loansDue,
  };
}

export function sortCashEntries(entries: CashEntry[]): CashEntry[] {
  return [...entries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id)
  );
}

/** Solde réel = ouverture + entrées − sorties (ne pas se fier à l’ordre Mongo). */
export function computeCashBalance(entries: CashEntry[], opening = 0): number {
  return entries.reduce((bal, e) => bal + (e.inflow || 0) - (e.outflow || 0), opening);
}

export async function rebuildCashBalances(
  entries: CashEntry[],
  opening = 0
): Promise<CashEntry[]> {
  let bal = opening;
  return sortCashEntries(entries).map((e) => {
    bal = bal + e.inflow - e.outflow;
    return { ...e, balance: bal };
  });
}

/** Origine des écritures auto liées aux cotisations. */
export const CASH_ORIGIN_CONTRIBUTION = "Cotisation";
export const CASH_ORIGIN_LOAN = "Prêt octroyé";

async function savePeriodCashbook(period: Period, entries: CashEntry[]): Promise<CashEntry[]> {
  const settings = await readObjectForPeriodId(period.id, "settings", DEFAULT_SETTINGS);
  const next = await rebuildCashBalances(entries, settings.cashOpeningBalance);
  await writeCollectionForPeriod(period, "cashbook", next);
  return next;
}

/**
 * Crée / met à jour / supprime l’écriture caisse d’une cotisation (référence = id cotisation).
 */
export async function syncContributionCashEntry(input: {
  period: Period;
  contributionId: string;
  amount: number;
  date: string;
  description: string;
  recordedBy: string;
}): Promise<void> {
  const items = await readCollectionForPeriodId<CashEntry>(input.period.id, "cashbook");
  const idx = items.findIndex(
    (e) => e.reference === input.contributionId && e.origin === CASH_ORIGIN_CONTRIBUTION
  );

  let next: CashEntry[];
  if (input.amount <= 0) {
    if (idx < 0) return;
    next = items.filter((_, i) => i !== idx);
  } else if (idx >= 0) {
    next = [...items];
    next[idx] = {
      ...next[idx],
      date: input.date,
      type: "Entrée",
      description: input.description,
      inflow: input.amount,
      outflow: 0,
      recordedBy: input.recordedBy,
    };
  } else {
    next = [
      ...items,
      {
        id: newId("TXN"),
        date: input.date,
        type: "Entrée",
        description: input.description,
        inflow: input.amount,
        outflow: 0,
        balance: 0,
        reference: input.contributionId,
        origin: CASH_ORIGIN_CONTRIBUTION,
        recordedBy: input.recordedBy,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  await savePeriodCashbook(input.period, next);
}

/**
 * Aligne le journal caisse sur cotisations + prêts décaissés (rattrapage + soldes).
 */
export async function reconcileContributionCashEntries(periodId: string): Promise<number> {
  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return 0;

  const [contributions, weeks, loans, cashbook, settings] = await Promise.all([
    readCollectionForPeriodId<Contribution>(periodId, "contributions"),
    readCollectionForPeriodId<{ id: string; date: string }>(periodId, "weeks"),
    readCollectionForPeriodId<Loan>(periodId, "loans"),
    readCollectionForPeriodId<CashEntry>(periodId, "cashbook"),
    readObjectForPeriodId(periodId, "settings", DEFAULT_SETTINGS),
  ]);

  const weekDate = new Map(weeks.map((w) => [w.id, w.date]));
  const paid = contributions.filter((c) => c.amount > 0);
  const paidIds = new Set(paid.map((c) => c.id));

  const disbursedLoans = loans.filter(
    (l) =>
      l.status === "En cours" ||
      l.status === "En retard" ||
      l.status === "Remboursé" ||
      Boolean(l.disbursedAt)
  );
  const disbursedIds = new Set(disbursedLoans.map((l) => l.id));

  let next = cashbook.filter((e) => {
    if (e.origin === CASH_ORIGIN_CONTRIBUTION) {
      return e.reference != null && paidIds.has(e.reference);
    }
    if (e.origin === CASH_ORIGIN_LOAN) {
      return e.reference != null && disbursedIds.has(e.reference);
    }
    return true;
  });
  let touched = next.length !== cashbook.length;

  for (const c of paid) {
    const date =
      weekDate.get(c.weekId) ||
      (c.paidAt && c.paidAt.length >= 10 ? c.paidAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    const description = `Cotisation ${c.id}`;
    const idx = next.findIndex(
      (e) => e.origin === CASH_ORIGIN_CONTRIBUTION && e.reference === c.id
    );
    if (idx < 0) {
      next = [
        ...next,
        {
          id: newId("TXN"),
          date,
          type: "Entrée",
          description,
          inflow: c.amount,
          outflow: 0,
          balance: 0,
          reference: c.id,
          origin: CASH_ORIGIN_CONTRIBUTION,
          recordedBy: c.recordedBy,
          createdAt: c.paidAt || new Date().toISOString(),
        },
      ];
      touched = true;
    } else if (
      next[idx].inflow !== c.amount ||
      next[idx].date !== date ||
      next[idx].type !== "Entrée"
    ) {
      next = [...next];
      next[idx] = {
        ...next[idx],
        date,
        type: "Entrée",
        description,
        inflow: c.amount,
        outflow: 0,
      };
      touched = true;
    }
  }

  for (const loan of disbursedLoans) {
    const amount = loan.amount + (loan.withdrawalFee || 0);
    const date = loan.disbursedAt?.slice(0, 10) || loan.date;
    const description = `Prêt ${loan.id}`;
    const idx = next.findIndex(
      (e) => e.origin === CASH_ORIGIN_LOAN && e.reference === loan.id
    );
    if (idx < 0) {
      next = [
        ...next,
        {
          id: newId("TXN"),
          date,
          type: "Sortie",
          description,
          inflow: 0,
          outflow: amount,
          balance: 0,
          reference: loan.id,
          origin: CASH_ORIGIN_LOAN,
          recordedBy: loan.createdBy,
          createdAt: loan.disbursedAt || loan.createdAt,
        },
      ];
      touched = true;
    } else if (
      next[idx].outflow !== amount ||
      next[idx].type !== "Sortie" ||
      next[idx].date !== date
    ) {
      next = [...next];
      next[idx] = {
        ...next[idx],
        date,
        type: "Sortie",
        description,
        inflow: 0,
        outflow: amount,
      };
      touched = true;
    }
  }

  const rebuilt = await rebuildCashBalances(next, settings.cashOpeningBalance);
  const balancesDrift =
    rebuilt.length !== cashbook.length ||
    rebuilt.some((e, i) => {
      const cur = sortCashEntries(cashbook)[i];
      return !cur || cur.id !== e.id || cur.balance !== e.balance || cur.inflow !== e.inflow || cur.outflow !== e.outflow;
    });

  if (!touched && !balancesDrift) return 0;
  await writeCollectionForPeriod(period, "cashbook", rebuilt);
  return 1;
}

export async function appendCashEntry(input: {
  date: string;
  type: "Entrée" | "Sortie";
  description: string;
  amount: number;
  reference?: string;
  origin?: string;
  recordedBy: string;
  periodId?: string;
}): Promise<CashEntry> {
  const entry: CashEntry = {
    id: newId("TXN"),
    date: input.date,
    type: input.type,
    description: input.description,
    inflow: input.type === "Entrée" ? input.amount : 0,
    outflow: input.type === "Sortie" ? input.amount : 0,
    balance: 0,
    reference: input.reference,
    origin: input.origin,
    recordedBy: input.recordedBy,
    createdAt: new Date().toISOString(),
  };

  if (input.periodId) {
    const meta = await readMeta();
    const period = meta.periods.find((p) => p.id === input.periodId);
    if (!period) throw new Error("Tontine introuvable");
    const items = await readCollectionForPeriodId<CashEntry>(input.periodId, "cashbook");
    const next = await savePeriodCashbook(period, [...items, entry]);
    return next[next.length - 1];
  }

  const settings = await settingsRepo.get();
  await cashbookRepo.update(async (items) => {
    const next = [...items, entry];
    return rebuildCashBalances(next, settings.cashOpeningBalance);
  });

  const all = await cashbookRepo.all();
  return all[all.length - 1];
}

export async function upsertContribution(input: {
  memberId: string;
  weekId: string;
  amount: number;
  recordedBy: string;
  /** Obligatoire pour la grille multi-tontines */
  periodId: string;
}): Promise<Contribution> {
  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === input.periodId);
  if (!period) throw new Error("Tontine introuvable");

  const now = new Date().toISOString();
  const [items, weeks] = await Promise.all([
    readCollectionForPeriodId<Contribution>(input.periodId, "contributions"),
    readCollectionForPeriodId<{ id: string; date: string }>(input.periodId, "weeks"),
  ]);
  const weekDate = weeks.find((w) => w.id === input.weekId)?.date;
  const cashDate = weekDate || now.slice(0, 10);

  const idx = items.findIndex(
    (c) => c.memberId === input.memberId && c.weekId === input.weekId
  );

  if (idx >= 0) {
    const current = items[idx];
    const isLocked = current.locked !== false && current.amount > 0;
    if (isLocked) {
      throw new Error("Cotisation verrouillée");
    }
  }

  let next: Contribution[];
  let result: Contribution;

  if (input.amount <= 0) {
    if (idx < 0) {
      return {
        id: "none",
        memberId: input.memberId,
        weekId: input.weekId,
        amount: 0,
        paidAt: "",
        recordedBy: input.recordedBy,
      };
    }
    const removed = items[idx];
    next = items.filter((_, i) => i !== idx);
    await writeCollectionForPeriod(period, "contributions", next);
    await syncContributionCashEntry({
      period,
      contributionId: removed.id,
      amount: 0,
      date: cashDate,
      description: `Cotisation ${removed.id}`,
      recordedBy: input.recordedBy,
    });
    return { ...removed, amount: 0 };
  }

  if (idx >= 0) {
    result = {
      ...items[idx],
      amount: input.amount,
      paidAt: now,
      recordedBy: input.recordedBy,
      locked: true,
    };
    next = [...items];
    next[idx] = result;
  } else {
    result = {
      id: newId("COT"),
      memberId: input.memberId,
      weekId: input.weekId,
      amount: input.amount,
      paidAt: now,
      recordedBy: input.recordedBy,
      locked: true,
    };
    next = [...items, result];
  }

  await writeCollectionForPeriod(period, "contributions", next);
  await syncContributionCashEntry({
    period,
    contributionId: result.id,
    amount: result.amount,
    date: cashDate,
    description: `Cotisation ${result.id}`,
    recordedBy: input.recordedBy,
  });
  return result;
}

export async function unlockContribution(input: {
  periodId: string;
  memberId: string;
  weekId: string;
}): Promise<void> {
  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === input.periodId);
  if (!period) throw new Error("Tontine introuvable");

  const items = await readCollectionForPeriodId<Contribution>(input.periodId, "contributions");
  const idx = items.findIndex(
    (c) => c.memberId === input.memberId && c.weekId === input.weekId
  );
  if (idx < 0) throw new Error("Cotisation introuvable");

  const next = [...items];
  next[idx] = { ...next[idx], locked: false };
  await writeCollectionForPeriod(period, "contributions", next);
}

/** Jour calendaire ISO (YYYY-MM-DD) depuis un timestamp ISO. */
export function paidAtDay(paidAt: string): string {
  if (paidAt.length >= 10 && paidAt[4] === "-" && paidAt[7] === "-") {
    return paidAt.slice(0, 10);
  }
  const d = new Date(paidAt);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isLatePayment(weekDate: string, paidAt: string): boolean {
  const day = paidAtDay(paidAt);
  return Boolean(day && day > weekDate);
}

/** Crée les pénalités de retard manquantes pour une séance. Retourne le nombre créées. */
export async function applyLatePenaltiesForWeek(input: {
  period: Period;
  weekId: string;
  weekDate: string;
  recordedBy: string;
  penaltyAmount: number;
}): Promise<number> {
  const [contributions, penalties] = await Promise.all([
    readCollectionForPeriodId<Contribution>(input.period.id, "contributions"),
    readCollectionForPeriodId<Penalty>(input.period.id, "penalties"),
  ]);

  const lateMemberIds = contributions
    .filter(
      (c) =>
        c.weekId === input.weekId &&
        c.amount > 0 &&
        isLatePayment(input.weekDate, c.paidAt)
    )
    .map((c) => c.memberId);

  const existing = new Set(
    penalties
      .filter(
        (p) =>
          p.weekId === input.weekId &&
          p.motif === "retard_cotisation"
      )
      .map((p) => p.memberId)
  );

  const now = new Date().toISOString();
  const toAdd: Penalty[] = [];
  for (const memberId of lateMemberIds) {
    if (existing.has(memberId)) continue;
    toAdd.push({
      id: newId("PEN"),
      memberId,
      date: input.weekDate,
      motif: "retard_cotisation",
      motifLabel: "Retard cotisation",
      amount: input.penaltyAmount,
      paid: false,
      paidAt: null,
      weekId: input.weekId,
      notes: `Pénalité auto — paiement après le ${input.weekDate}`,
      recordedBy: input.recordedBy,
      createdAt: now,
    });
  }

  if (toAdd.length === 0) return 0;
  await writeCollectionForPeriod(input.period, "penalties", [...penalties, ...toAdd]);
  return toAdd.length;
}

export type MemberProgress = {
  member: EnrolledMember;
  totalContributed: number;
  weeklyTarget: number;
  weeksPaid: number;
  weeksTotal: number;
  missingWeeks: string[];
  penaltiesDue: number;
  loansOutstanding: number;
  netBalance: number;
  contributions: Contribution[];
  loans: Loan[];
  repayments: Repayment[];
  penalties: Penalty[];
};

export async function getMemberProgress(memberId: string): Promise<MemberProgress | null> {
  const [members, weeks, contributions, loans, repayments, penalties] = await Promise.all([
    membersRepo.all(),
    weeksRepo.all(),
    contributionsRepo.all(),
    loansRepo.all(),
    repaymentsRepo.all(),
    penaltiesRepo.all(),
  ]);

  const member = members.find((m) => m.id === memberId);
  if (!member) return null;

  const memberContributions = contributions.filter((c) => c.memberId === memberId);
  const paidWeekIds = new Set(memberContributions.map((c) => c.weekId));
  const missingWeeks = weeks
    .filter((w) => !paidWeekIds.has(w.id))
    .map((w) => w.label || w.date);

  const balance = await getMemberBalance(memberId);
  const memberLoans = loans.filter((l) => l.memberId === memberId);
  const loanIds = new Set(memberLoans.map((l) => l.id));

  return {
    member,
    totalContributed: balance.totalContributed,
    weeklyTarget: member.weeklyTarget,
    weeksPaid: paidWeekIds.size,
    weeksTotal: weeks.length,
    missingWeeks,
    penaltiesDue: balance.penaltiesDue,
    loansOutstanding: balance.loansOutstanding,
    netBalance: balance.netBalance,
    contributions: memberContributions,
    loans: memberLoans,
    repayments: repayments.filter((r) => loanIds.has(r.loanId)),
    penalties: penalties.filter((p) => p.memberId === memberId),
  };
}
