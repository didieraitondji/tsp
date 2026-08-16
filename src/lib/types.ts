export type Role = "SUPER_ADMIN" | "GESTIONNAIRE" | "GESTIONNAIRE_LECTURE" | "MEMBRE";

export type MemberStatus = "Actif" | "Inactif" | "Suspendu";

export type LoanStatus =
  | "En attente"
  | "Refusé"
  | "En cours"
  | "Remboursé"
  | "En retard"
  | "—";

export type PenaltyMotif = "retard_cotisation" | "absence_reunion" | "autre";

export type CashType = "Entrée" | "Sortie";

export interface User {
  id: string;
  phone: string;
  passwordHash: string;
  name: string;
  role: Role;
  memberId?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Email pour OTP (setup MDP / 2FA). */
  email?: string | null;
  /** true tant que le MDP temporaire n’a pas été changé. */
  mustChangePassword?: boolean;
  /** 2FA email OTP — Super admin / Gestionnaire / Lecture uniquement. */
  twoFactorEnabled?: boolean;
}

export interface Settings {
  interestRateMonthly: number;
  interestRateExtra: number;
  contributionMin: number;
  contributionStandard: number;
  penaltyLateContribution: number;
  penaltyAbsence: number;
  loanWithdrawalFeeRate: number;
  loanMaxDurationMonths: number;
  /** Au-delà de ce montant (FCFA), 2 cautions sont exigées. */
  loanSecondWitnessThreshold: number;
  maxMembers: number;
  year: number;
  cashOpeningBalance: number;
  organizationName: string;
  /** Si true, déverrouiller une cotisation exige le mot de passe. */
  requirePasswordToUnlockContribution: boolean;
  /** Numéro Mobile Money pour déposer les mises (1). */
  depositPhone1: string;
  /** Nom sous lequel le numéro 1 est enregistré. */
  depositName1: string;
  /** Numéro Mobile Money pour déposer les mises (2, optionnel). */
  depositPhone2: string;
  /** Nom sous lequel le numéro 2 est enregistré. */
  depositName2: string;
}

/** Annuaire global — identité du membre (hors inscription à une tontine). */
export interface Member {
  id: string;
  lastName: string;
  firstName: string;
  phone?: string;
  email?: string;
  sex?: "M" | "F" | "";
  cip?: string;
  birthDate?: string;
  /** Date d’enregistrement dans l’annuaire global */
  joinedAt: string;
  address?: string;
  profession?: string;
  sponsor?: string;
  notes?: string;
  origin?: string;
  emergencyContact?: string;
}

/** Copie d’identité figée sur une tontine (après retrait de l’annuaire). */
export type MemberSnapshot = Omit<Member, "id" | "joinedAt">;

/** Inscription d’un membre global à une tontine (période). */
export interface Enrollment {
  id: string;
  memberId: string;
  joinedAt: string;
  status: MemberStatus;
  weeklyTarget: number;
  /** Présent si le membre a été retiré de l’annuaire : conserve la trace sur la tontine. */
  memberSnapshot?: MemberSnapshot;
  removedFromDirectoryAt?: string;
}

/** Membre inscrit à la tontine active (jointure Member × Enrollment). */
export type EnrolledMember = Member & {
  enrollmentId: string;
  status: MemberStatus;
  weeklyTarget: number;
  /** Plus dans l’annuaire : affiché via memberSnapshot. */
  archivedFromDirectory?: boolean;
};

export interface Week {
  id: string;
  date: string;
  label: string;
  month: number;
  year: number;
}

export type ContributionStatus = "paid" | "unpaid";

export interface Contribution {
  id: string;
  memberId: string;
  weekId: string;
  amount: number;
  paidAt: string;
  recordedBy: string;
  /** false après déverrouillage ; true (ou absent) = lecture seule une fois marqué */
  locked?: boolean;
  /**
   * Statut explicite (grille Payé / Impayé).
   * Legacy : absent + amount>0 ⇒ payé ; absent + amount=0 / pas d’enregistrement ⇒ non marqué.
   */
  status?: ContributionStatus;
}

export interface LoanApproval {
  userId: string;
  userName: string;
  decision: "approved" | "rejected";
  at: string;
  note?: string;
}

/** Caution / témoin d’un prêt. */
export interface LoanWitness {
  memberId?: string;
  name: string;
  phone?: string;
  address?: string;
  isGroupMember: boolean;
  /** Copie CIP fournie (requis si caution externe). */
  cipProvided?: boolean;
}

export interface LoanDocsChecklist {
  letterSigned: boolean;
  cipVerified: boolean;
}

export interface Loan {
  id: string;
  memberId: string;
  date: string;
  amount: number;
  withdrawalFee: number;
  /** Témoin du demandeur (obligatoire) — sync avec witnesses[0]. */
  witnessName: string;
  witnessPhone?: string;
  witnessAddress?: string;
  /** Cautions structurées (V1 règles bureau). */
  witnesses?: LoanWitness[];
  docsChecklist?: LoanDocsChecklist;
  /** Mois de retard déjà facturés (intérêt extra). */
  lateInterestAppliedMonths?: number;
  dueDate: string;
  /** Si false, aucun intérêt (contrat ni retard). Défaut true si absent. */
  applyInterest?: boolean;
  /** Prêt historique déjà soldé à l’enregistrement. */
  alreadySettled?: boolean;
  /** Date du solde (remboursement final), si alreadySettled. */
  settledAt?: string;
  /**
   * Tranches déjà versées (import historique), appliquées à l’approbation.
   * Vidées une fois traitées.
   */
  pendingHistoricalRepayments?: { date: string; amount: number }[];
  interestMonth1: number;
  interestMonth2: number;
  interestExtra: number;
  totalDue: number;
  repaid: number;
  status: LoanStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  /** Gestionnaires devant valider (snapshot à la création). */
  requiredApproverIds?: string[];
  approvals?: LoanApproval[];
  /** Date de décaissement (après validations). */
  disbursedAt?: string | null;
}

export interface Repayment {
  id: string;
  loanId: string;
  date: string;
  amount: number;
  capital: number;
  interest: number;
  remainingBalance: number;
  recordedBy: string;
  createdAt: string;
}

export interface Penalty {
  id: string;
  memberId: string;
  date: string;
  motif: PenaltyMotif;
  motifLabel: string;
  amount: number;
  paid: boolean;
  paidAt?: string | null;
  notes?: string;
  recordedBy: string;
  createdAt: string;
  /** Lien séance pour idempotence des pénalités de retard */
  weekId?: string;
}

export interface CashEntry {
  id: string;
  date: string;
  type: CashType;
  description: string;
  inflow: number;
  outflow: number;
  balance: number;
  reference?: string;
  origin?: string;
  recordedBy: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  details?: string;
}

export type PeriodStatus = "active" | "closed" | "draft";

export type Periodicity =
  | { type: "weekday"; weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: "every_n_days"; intervalDays: number };

export type PeriodBinKey =
  | "settings"
  | "enrollments"
  | "weeks"
  | "contributions"
  | "loans"
  | "repayments"
  | "penalties"
  | "cashbook"
  | "audit";

export interface PeriodBins {
  settings: string;
  enrollments: string;
  weeks: string;
  contributions: string;
  loans: string;
  repayments: string;
  penalties: string;
  cashbook: string;
  audit: string;
}

/** Cycle de tontine (une tontine = une Period enrichie). */
export interface Period {
  id: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  periodicity: Periodicity;
  enrollmentsOpen: boolean;
  status: PeriodStatus;
  createdAt: string;
  /** Présent en mode local ; inutile en MongoDB */
  bins?: PeriodBins;
}

export interface AppMeta {
  version: 1;
  activePeriodId: string | null;
  periods: Period[];
}
