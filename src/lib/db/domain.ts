import { v4 as uuid } from "uuid";
import type {
  CashEntry,
  Contribution,
  EnrolledMember,
  Enrollment,
  Loan,
  Member,
  MemberStatus,
  Penalty,
  Period,
  PeriodStatus,
  Repayment,
  Settings,
  Week,
} from "@/lib/types";
import {
  cashbookRepo,
  contributionsRepo,
  enrollmentsRepo,
  globalMembersRepo,
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
  isContributionRecordLocked,
} from "@/lib/contribution-status";
import { listPeriods } from "./periods";
import {
  readCollectionForPeriodId,
  readMeta,
  readObjectForPeriodId,
  updateCollectionForPeriod,
  withPeriodBinLock,
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
export const CASH_ORIGIN_PENALTY = "Pénalité";

function cashAutoKey(origin: string | undefined, reference: string | undefined): string | null {
  if (!origin || !reference) return null;
  return `${origin}::${reference}`;
}

/** Une seule écriture par (origin, reference) — garde la plus ancienne. */
export function dedupeCashEntriesByOriginReference(entries: CashEntry[]): CashEntry[] {
  const kept = new Map<string, CashEntry>();
  const passthrough: CashEntry[] = [];

  for (const e of sortCashEntries(entries)) {
    const key = cashAutoKey(e.origin, e.reference);
    if (!key) {
      passthrough.push(e);
      continue;
    }
    if (!kept.has(key)) kept.set(key, e);
  }

  return [...passthrough, ...kept.values()];
}

async function savePeriodCashbook(period: Period, entries: CashEntry[]): Promise<CashEntry[]> {
  const settings = await readObjectForPeriodId(period.id, "settings", DEFAULT_SETTINGS);
  const deduped = dedupeCashEntriesByOriginReference(entries);
  const next = await rebuildCashBalances(deduped, settings.cashOpeningBalance);
  await writeCollectionForPeriod(period, "cashbook", next);
  return next;
}

/** Retire les écritures caisse liées à une référence (ex. pénalité payée). Recalcule les soldes. */
export async function removeCashEntriesByReference(input: {
  periodId: string;
  reference: string;
  origin: string;
}): Promise<number> {
  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === input.periodId);
  if (!period) return 0;

  let removed = 0;
  await updateCollectionForPeriod<CashEntry>(period, "cashbook", async (items) => {
    const next = items.filter(
      (e) => !(e.reference === input.reference && e.origin === input.origin)
    );
    removed = items.length - next.length;
    if (removed === 0) return items;
    const settings = await readObjectForPeriodId(period.id, "settings", DEFAULT_SETTINGS);
    return rebuildCashBalances(next, settings.cashOpeningBalance);
  });
  return removed;
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
  const settings = await readObjectForPeriodId(input.period.id, "settings", DEFAULT_SETTINGS);

  await updateCollectionForPeriod<CashEntry>(input.period, "cashbook", async (items) => {
    const existing = items.filter(
      (e) =>
        e.reference === input.contributionId && e.origin === CASH_ORIGIN_CONTRIBUTION
    );
    const others = items.filter(
      (e) =>
        !(e.reference === input.contributionId && e.origin === CASH_ORIGIN_CONTRIBUTION)
    );

    let next: CashEntry[];
    if (input.amount <= 0) {
      if (existing.length === 0) return items;
      next = others;
    } else {
      const base = existing[0];
      const entry: CashEntry = {
        id: base?.id || newId("TXN"),
        date: input.date,
        type: "Entrée",
        description: input.description,
        inflow: input.amount,
        outflow: 0,
        balance: 0,
        reference: input.contributionId,
        origin: CASH_ORIGIN_CONTRIBUTION,
        recordedBy: input.recordedBy,
        createdAt: base?.createdAt || new Date().toISOString(),
      };
      next = [...others, entry];
    }

    return rebuildCashBalances(next, settings.cashOpeningBalance);
  });
}

/**
 * Aligne le journal caisse sur cotisations + prêts décaissés (rattrapage + soldes).
 * Déduplique aussi les écritures auto en double (même origin + reference).
 */
export async function reconcileContributionCashEntries(periodId: string): Promise<number> {
  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return 0;

  const [contributions, weeks, loans, settings] = await Promise.all([
    readCollectionForPeriodId<Contribution>(periodId, "contributions"),
    readCollectionForPeriodId<{ id: string; date: string }>(periodId, "weeks"),
    readCollectionForPeriodId<Loan>(periodId, "loans"),
    readObjectForPeriodId(periodId, "settings", DEFAULT_SETTINGS),
  ]);

  const weekDate = new Map(weeks.map((w) => [w.id, w.date]));
  // Uniquement les cotisations payées encore verrouillées (déverrouillé = hors caisse)
  const paid = contributions.filter(
    (c) => c.amount > 0 && isContributionRecordLocked(c)
  );
  const paidIds = new Set(paid.map((c) => c.id));

  const disbursedLoans = loans.filter(
    (l) =>
      l.status === "En cours" ||
      l.status === "En retard" ||
      l.status === "Remboursé" ||
      Boolean(l.disbursedAt)
  );
  const disbursedIds = new Set(disbursedLoans.map((l) => l.id));

  return withPeriodBinLock(period.id, "cashbook", async () => {
    const cashbook = await readCollectionForPeriodId<CashEntry>(periodId, "cashbook");
    const beforeCount = cashbook.length;

    let next = dedupeCashEntriesByOriginReference(cashbook);
    next = next.filter((e) => {
      if (e.origin === CASH_ORIGIN_CONTRIBUTION) {
        return e.reference != null && paidIds.has(e.reference);
      }
      if (e.origin === CASH_ORIGIN_LOAN) {
        return e.reference != null && disbursedIds.has(e.reference);
      }
      return true;
    });
    let touched = next.length !== beforeCount;

    for (const c of paid) {
      const date =
        weekDate.get(c.weekId) ||
        (c.paidAt && c.paidAt.length >= 10
          ? c.paidAt.slice(0, 10)
          : new Date().toISOString().slice(0, 10));
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
    const sortedPrev = sortCashEntries(dedupeCashEntriesByOriginReference(cashbook));
    const balancesDrift =
      rebuilt.length !== sortedPrev.length ||
      rebuilt.some((e, i) => {
        const cur = sortedPrev[i];
        return (
          !cur ||
          cur.id !== e.id ||
          cur.balance !== e.balance ||
          cur.inflow !== e.inflow ||
          cur.outflow !== e.outflow
        );
      });

    if (!touched && !balancesDrift) return 0;
    await writeCollectionForPeriod(period, "cashbook", rebuilt);
    return beforeCount - rebuilt.length || 1;
  });
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
    const settings = await readObjectForPeriodId(period.id, "settings", DEFAULT_SETTINGS);
    const next = await updateCollectionForPeriod<CashEntry>(period, "cashbook", async (items) => {
      return rebuildCashBalances(
        dedupeCashEntriesByOriginReference([...items, entry]),
        settings.cashOpeningBalance
      );
    });
    return next.find((e) => e.id === entry.id) ?? next[next.length - 1];
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

  if (idx >= 0 && isContributionRecordLocked(items[idx])) {
    throw new Error("Cotisation verrouillée");
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
      status: "paid",
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
      status: "paid",
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

/**
 * Marque une cotisation Payé (montant = cible) ou Impayé (0 + pénalité).
 * La pénalité d’impayé est idempotente et n’est jamais retirée si on repasse en Payé.
 */
export async function markContributionStatus(input: {
  periodId: string;
  memberId: string;
  weekId: string;
  status: "paid" | "unpaid";
  weeklyTarget: number;
  recordedBy: string;
  penaltyAmount: number;
}): Promise<{ contribution: Contribution; penaltyCreated: boolean }> {
  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === input.periodId);
  if (!period) throw new Error("Tontine introuvable");

  if (input.status === "paid" && !(input.weeklyTarget > 0)) {
    throw new Error("Cible de cotisation invalide.");
  }

  const now = new Date().toISOString();
  const [items, weeks, penalties] = await Promise.all([
    readCollectionForPeriodId<Contribution>(input.periodId, "contributions"),
    readCollectionForPeriodId<{ id: string; date: string }>(input.periodId, "weeks"),
    readCollectionForPeriodId<Penalty>(input.periodId, "penalties"),
  ]);

  const week = weeks.find((w) => w.id === input.weekId);
  if (!week) throw new Error("Séance introuvable");
  const cashDate = week.date || now.slice(0, 10);

  const idx = items.findIndex(
    (c) => c.memberId === input.memberId && c.weekId === input.weekId
  );
  if (idx >= 0 && isContributionRecordLocked(items[idx])) {
    throw new Error("Cotisation verrouillée");
  }

  const amount = input.status === "paid" ? input.weeklyTarget : 0;
  let result: Contribution;
  let next: Contribution[];

  if (idx >= 0) {
    result = {
      ...items[idx],
      amount,
      paidAt: now,
      recordedBy: input.recordedBy,
      locked: true,
      status: input.status,
    };
    next = [...items];
    next[idx] = result;
  } else {
    result = {
      id: newId("COT"),
      memberId: input.memberId,
      weekId: input.weekId,
      amount,
      paidAt: now,
      recordedBy: input.recordedBy,
      locked: true,
      status: input.status,
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

  let penaltyCreated = false;
  if (input.status === "unpaid" && input.penaltyAmount > 0) {
    const already = penalties.some(
      (p) =>
        p.memberId === input.memberId &&
        p.weekId === input.weekId &&
        p.motif === "retard_cotisation"
    );
    if (!already) {
      const penalty: Penalty = {
        id: newId("PEN"),
        memberId: input.memberId,
        date: cashDate,
        motif: "retard_cotisation",
        motifLabel: "Cotisation impayée",
        amount: input.penaltyAmount,
        paid: false,
        paidAt: null,
        weekId: input.weekId,
        notes: `Pénalité auto — marqué impayé pour la séance du ${cashDate}`,
        recordedBy: input.recordedBy,
        createdAt: now,
      };
      await writeCollectionForPeriod(period, "penalties", [...penalties, penalty]);
      penaltyCreated = true;
    }
  }

  return { contribution: result, penaltyCreated };
}

export async function unlockContribution(input: {
  periodId: string;
  memberId: string;
  weekId: string;
}): Promise<void> {
  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === input.periodId);
  if (!period) throw new Error("Tontine introuvable");

  const [items, weeks] = await Promise.all([
    readCollectionForPeriodId<Contribution>(input.periodId, "contributions"),
    readCollectionForPeriodId<{ id: string; date: string }>(input.periodId, "weeks"),
  ]);
  const idx = items.findIndex(
    (c) => c.memberId === input.memberId && c.weekId === input.weekId
  );
  if (idx < 0) throw new Error("Cotisation introuvable");

  const current = items[idx];
  const next = [...items];
  next[idx] = { ...current, locked: false };
  await writeCollectionForPeriod(period, "contributions", next);

  // Tant que ce n’est pas re-verrouillé « Payé », l’écriture caisse est retirée
  // (cohérent avec le total de colonne qui n’affiche que le verrouillé).
  const weekDate = weeks.find((w) => w.id === input.weekId)?.date;
  await syncContributionCashEntry({
    period,
    contributionId: current.id,
    amount: 0,
    date: weekDate || new Date().toISOString().slice(0, 10),
    description: `Cotisation ${current.id}`,
    recordedBy: current.recordedBy,
  });
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
  periodId: string | null;
  periodName: string | null;
  enrolled: boolean;
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

export type MemberTontineOption = {
  id: string;
  name: string;
  status: PeriodStatus;
  weeklyTarget: number;
  enrollmentStatus: MemberStatus;
};

/** Tontines où le membre est inscrit. */
export async function listMemberTontines(memberId: string): Promise<MemberTontineOption[]> {
  const periods = await listPeriods();
  const rows = await Promise.all(
    periods.map(async (p) => {
      const enrollments = await readCollectionForPeriodId<Enrollment>(p.id, "enrollments");
      const enrollment = enrollments.find((e) => e.memberId === memberId);
      if (!enrollment) return null;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        weeklyTarget: enrollment.weeklyTarget,
        enrollmentStatus: enrollment.status,
      } satisfies MemberTontineOption;
    })
  );

  return rows
    .filter((r): r is MemberTontineOption => r !== null)
    .sort(
      (a, b) =>
        Number(b.status === "active") - Number(a.status === "active") ||
        a.name.localeCompare(b.name, "fr")
    );
}

/** Choisit la tontine à afficher (query > active > première). */
export function resolveMemberTontineId(
  tontines: MemberTontineOption[],
  requested?: string | null
): string | null {
  if (tontines.length === 0) return null;
  if (requested && tontines.some((t) => t.id === requested)) return requested;
  return tontines.find((t) => t.status === "active")?.id ?? tontines[0].id;
}

/**
 * Progression d’un membre pour une tontine donnée.
 * Sans periodId : fiche annuaire seule (pas d’inscription / données métier vides).
 */
export async function getMemberProgress(
  memberId: string,
  periodId?: string | null
): Promise<MemberProgress | null> {
  const directory = await globalMembersRepo.all();
  const member = directory.find((m) => m.id === memberId);
  if (!member) return null;

  if (!periodId) {
    return {
      member: {
        ...member,
        enrollmentId: "",
        status: "Inactif",
        weeklyTarget: 0,
      },
      periodId: null,
      periodName: null,
      enrolled: false,
      totalContributed: 0,
      weeklyTarget: 0,
      weeksPaid: 0,
      weeksTotal: 0,
      missingWeeks: [],
      penaltiesDue: 0,
      loansOutstanding: 0,
      netBalance: 0,
      contributions: [],
      loans: [],
      repayments: [],
      penalties: [],
    };
  }

  const periods = await listPeriods();
  const period = periods.find((p) => p.id === periodId) ?? null;

  const [enrollments, weeks, contributions, loans, repayments, penalties] = await Promise.all([
    readCollectionForPeriodId<Enrollment>(periodId, "enrollments"),
    readCollectionForPeriodId<Week>(periodId, "weeks"),
    readCollectionForPeriodId<Contribution>(periodId, "contributions"),
    readCollectionForPeriodId<Loan>(periodId, "loans"),
    readCollectionForPeriodId<Repayment>(periodId, "repayments"),
    readCollectionForPeriodId<Penalty>(periodId, "penalties"),
  ]);

  const enrollment = enrollments.find((e) => e.memberId === memberId);
  const weeklyTarget = enrollment?.weeklyTarget ?? 0;

  const memberContributions = contributions.filter((c) => c.memberId === memberId);
  const paidWeekIds = new Set(memberContributions.map((c) => c.weekId));
  const missingWeeks = weeks
    .filter((w) => !paidWeekIds.has(w.id))
    .map((w) => w.label || w.date);

  const totalContributed = memberContributions.reduce((s, c) => s + c.amount, 0);
  const penaltiesDue = penalties
    .filter((p) => p.memberId === memberId && !p.paid)
    .reduce((s, p) => s + p.amount, 0);
  const memberLoans = loans.filter((l) => l.memberId === memberId);
  const loansOutstanding = memberLoans
    .filter((l) => l.status !== "Remboursé")
    .reduce((s, l) => s + loanRemaining(l), 0);
  const loanIds = new Set(memberLoans.map((l) => l.id));

  return {
    member: {
      ...member,
      enrollmentId: enrollment?.id ?? "",
      status: enrollment?.status ?? "Inactif",
      weeklyTarget,
    },
    periodId,
    periodName: period?.name ?? null,
    enrolled: Boolean(enrollment),
    totalContributed,
    weeklyTarget,
    weeksPaid: paidWeekIds.size,
    weeksTotal: weeks.length,
    missingWeeks,
    penaltiesDue,
    loansOutstanding,
    netBalance: totalContributed - penaltiesDue - loansOutstanding,
    contributions: memberContributions,
    loans: memberLoans,
    repayments: repayments.filter((r) => loanIds.has(r.loanId)),
    penalties: penalties.filter((p) => p.memberId === memberId),
  };
}
