import type {
  AuditEntry,
  CashEntry,
  Contribution,
  EnrolledMember,
  Enrollment,
  Loan,
  Member,
  Penalty,
  Repayment,
  Settings,
  User,
  Week,
} from "@/lib/types";
import { DEFAULT_SETTINGS } from "./defaults";
import {
  readCollection,
  readCollectionForPeriodId,
  readObject,
  updateCollection,
  writeCollection,
  writeObject,
} from "./store";

export { DEFAULT_SETTINGS };

export const usersRepo = {
  all: () => readCollection<User>("users"),
  save: (items: User[]) => writeCollection("users", items),
  update: (fn: (items: User[]) => User[] | Promise<User[]>) => updateCollection("users", fn),
};

export const settingsRepo = {
  get: () => readObject<Settings>("settings", DEFAULT_SETTINGS),
  save: (s: Settings) => writeObject("settings", s),
};

/** Annuaire global de membres (toutes tontines). */
export const globalMembersRepo = {
  all: () => readCollection<Member>("members"),
  save: (items: Member[]) => writeCollection("members", items),
  update: (fn: (items: Member[]) => Member[] | Promise<Member[]>) =>
    updateCollection("members", fn),
};

export const enrollmentsRepo = {
  all: () => readCollection<Enrollment>("enrollments"),
  save: (items: Enrollment[]) => writeCollection("enrollments", items),
  update: (fn: (items: Enrollment[]) => Enrollment[] | Promise<Enrollment[]>) =>
    updateCollection("enrollments", fn),
};

function joinEnrolled(members: Member[], enrollments: Enrollment[]): EnrolledMember[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const result: EnrolledMember[] = [];
  for (const e of enrollments) {
    const m = byId.get(e.memberId);
    if (m) {
      result.push({
        ...m,
        enrollmentId: e.id,
        status: e.status,
        weeklyTarget: e.weeklyTarget,
        joinedAt: e.joinedAt,
      });
      continue;
    }
    if (e.memberSnapshot) {
      result.push({
        id: e.memberId,
        ...e.memberSnapshot,
        joinedAt: e.joinedAt,
        enrollmentId: e.id,
        status: e.status,
        weeklyTarget: e.weeklyTarget,
        archivedFromDirectory: true,
      });
    }
  }
  return result;
}

/**
 * Membres inscrits à la tontine du contexte courant (cookie / sélection).
 * Préférer listEnrolledForPeriod quand l’écran filtre par tontine.
 */
export const membersRepo = {
  all: async (): Promise<EnrolledMember[]> => {
    const [members, enrollments] = await Promise.all([
      globalMembersRepo.all(),
      enrollmentsRepo.all(),
    ]);
    return joinEnrolled(members, enrollments);
  },
};

/** Membres inscrits à une tontine donnée (indépendant de la sélection globale). */
export async function listEnrolledForPeriod(periodId: string): Promise<EnrolledMember[]> {
  const [members, enrollments] = await Promise.all([
    globalMembersRepo.all(),
    readCollectionForPeriodId<Enrollment>(periodId, "enrollments"),
  ]);
  return joinEnrolled(members, enrollments);
}

export const weeksRepo = {
  all: () => readCollection<Week>("weeks"),
  save: (items: Week[]) => writeCollection("weeks", items),
  update: (fn: (items: Week[]) => Week[] | Promise<Week[]>) => updateCollection("weeks", fn),
};

export const contributionsRepo = {
  all: () => readCollection<Contribution>("contributions"),
  save: (items: Contribution[]) => writeCollection("contributions", items),
  update: (fn: (items: Contribution[]) => Contribution[] | Promise<Contribution[]>) =>
    updateCollection("contributions", fn),
};

export const loansRepo = {
  all: () => readCollection<Loan>("loans"),
  save: (items: Loan[]) => writeCollection("loans", items),
  update: (fn: (items: Loan[]) => Loan[] | Promise<Loan[]>) => updateCollection("loans", fn),
};

export const repaymentsRepo = {
  all: () => readCollection<Repayment>("repayments"),
  save: (items: Repayment[]) => writeCollection("repayments", items),
  update: (fn: (items: Repayment[]) => Repayment[] | Promise<Repayment[]>) =>
    updateCollection("repayments", fn),
};

export const penaltiesRepo = {
  all: () => readCollection<Penalty>("penalties"),
  save: (items: Penalty[]) => writeCollection("penalties", items),
  update: (fn: (items: Penalty[]) => Penalty[] | Promise<Penalty[]>) =>
    updateCollection("penalties", fn),
};

export const cashbookRepo = {
  all: () => readCollection<CashEntry>("cashbook"),
  save: (items: CashEntry[]) => writeCollection("cashbook", items),
  update: (fn: (items: CashEntry[]) => CashEntry[] | Promise<CashEntry[]>) =>
    updateCollection("cashbook", fn),
};

export const auditRepo = {
  all: () => readCollection<AuditEntry>("audit"),
  save: (items: AuditEntry[]) => writeCollection("audit", items),
  update: (fn: (items: AuditEntry[]) => AuditEntry[] | Promise<AuditEntry[]>) =>
    updateCollection("audit", fn),
};
