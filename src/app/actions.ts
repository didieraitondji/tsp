"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auditRepo, globalMembersRepo, settingsRepo, usersRepo } from "@/lib/db/collections";
import { appendCashEntry, applyLatePenaltiesForWeek, computeLoanFigures, newId, unlockContribution, upsertContribution } from "@/lib/db/domain";
import {
  requireGestionWrite,
  requireLoanApprover,
  requireRole,
  requireSession,
} from "@/lib/auth/session";
import { isLoanQuorumRole } from "@/lib/auth/permissions";
import {
  cashInputSchema,
  createPeriodSchema,
  createUserSchema,
  contributionInputSchema,
  enrollmentFieldsSchema,
  loanInputSchema,
  memberSchema,
  penaltyInputSchema,
  repaymentInputSchema,
  settingsSchema,
  updateUserSchema,
  weekInputSchema,
} from "@/lib/schemas";
import type { Enrollment, Loan, Member, MemberSnapshot, Penalty, Periodicity, Repayment, User } from "@/lib/types";
import { loanRemaining } from "@/lib/db/domain";
import {
  closeEnrollments,
  closePeriod,
  createPeriod,
  deletePeriod,
  setActivePeriod,
} from "@/lib/db/periods";
import { PERIOD_COOKIE, readCollectionForPeriodId, readMeta, readObjectForPeriodId, writeCollectionForPeriod, writeObjectForPeriodId } from "@/lib/db/store";
import { DEFAULT_SETTINGS } from "@/lib/db/defaults";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizePhone, phonesMatch } from "@/lib/phone";

const GESTION_PARAMETRES = "/gestion/parametres?section=periodes";

async function verifySessionPassword(password: string): Promise<boolean> {
  const session = await requireSession();
  const users = await usersRepo.all();
  const user = users.find((u) => u.id === session.user.id);
  if (!user?.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

async function audit(action: string, details?: string) {
  const session = await requireSession();
  try {
    await auditRepo.update((items) => [
      ...items,
      {
        id: newId("AUD"),
        at: new Date().toISOString(),
        actorId: session.user.id,
        actorName: session.user.name,
        action,
        details,
      },
    ]);
  } catch {
    /* pas de tontine active pour écrire l’audit */
  }
}

export async function createUserAction(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const parsed = createUserSchema.safeParse({
    phone: formData.get("phone"),
    password: formData.get("password") || undefined,
    name: formData.get("name"),
    role: formData.get("role"),
    memberId: formData.get("memberId") || null,
    active: formData.get("active") !== "false",
    email: formData.get("email") || "",
  });
  if (!parsed.success) return;

  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  if (!phone) return;
  const users = await usersRepo.all();
  if (users.some((u) => phonesMatch(u.phone, phone))) {
    return;
  }

  const { DEFAULT_TEMP_PASSWORD } = await import("@/lib/auth/constants");
  const tempPassword = data.password || DEFAULT_TEMP_PASSWORD;
  const email = data.email?.trim() ? data.email.trim().toLowerCase() : null;

  const now = new Date().toISOString();
  const user: User = {
    id: newId("USR"),
    phone,
    passwordHash: await bcrypt.hash(tempPassword, 10),
    name: data.name,
    role: data.role,
    memberId: data.role === "MEMBRE" ? data.memberId : null,
    active: data.active,
    email,
    mustChangePassword: true,
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
  };

  await usersRepo.update((items) => [...items, user]);
  await audit("user.create", `${user.phone} (${user.role})`);
  revalidatePath("/admin/utilisateurs");
  return;
}

export async function updateUserAction(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const parsed = updateUserSchema.safeParse({
    id: formData.get("id"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password") || undefined,
    name: formData.get("name") || undefined,
    role: formData.get("role") || undefined,
    memberId: formData.has("memberId") ? formData.get("memberId") || null : undefined,
    active: formData.has("active") ? formData.get("active") === "true" : undefined,
  });
  if (!parsed.success) return;

  const data = parsed.data;
  const phone = data.phone ? normalizePhone(data.phone) : undefined;
  if (data.phone && !phone) return;
  await usersRepo.update(async (items) => {
    if (phone && items.some((u) => u.id !== data.id && phonesMatch(u.phone, phone))) {
      return items;
    }
    const idx = items.findIndex((u) => u.id === data.id);
    if (idx < 0) return items;
    const current = items[idx];
    const next: User = {
      ...current,
      phone: phone ?? current.phone,
      name: data.name ?? current.name,
      role: data.role ?? current.role,
      memberId:
        (data.role ?? current.role) === "MEMBRE"
          ? (data.memberId !== undefined ? data.memberId : current.memberId)
          : null,
      active: data.active ?? current.active,
      passwordHash: data.password
        ? await bcrypt.hash(data.password, 10)
        : current.passwordHash,
      updatedAt: new Date().toISOString(),
    };
    const copy = [...items];
    copy[idx] = next;
    return copy;
  });
  await audit("user.update", data.id);
  revalidatePath("/admin/utilisateurs");
  return;
}

export type SaveSettingsState = { error?: string; ok?: boolean } | null;

function parseSettingsRate(raw: FormDataEntryValue | null): number {
  let n = Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  // Saisie en % (ex. 2 ou 10) → décimal ; 0.02 / 0.1 restent tels quels
  if (n > 1) n = n / 100;
  return n;
}

export async function saveSettingsAction(
  _prev: SaveSettingsState,
  formData: FormData
): Promise<SaveSettingsState> {
  await requireRole(["SUPER_ADMIN"]);
  const password = String(formData.get("password") || "");
  if (!password) return { error: "Mot de passe requis." };

  const okPwd = await verifySessionPassword(password);
  if (!okPwd) return { error: "Mot de passe incorrect." };

  const parsed = settingsSchema.safeParse({
    interestRateMonthly: parseSettingsRate(formData.get("interestRateMonthly")),
    interestRateExtra: parseSettingsRate(formData.get("interestRateExtra")),
    contributionMin: Number(formData.get("contributionMin")),
    contributionStandard: Number(formData.get("contributionStandard")),
    penaltyLateContribution: Number(formData.get("penaltyLateContribution")),
    penaltyAbsence: Number(formData.get("penaltyAbsence")),
    loanWithdrawalFeeRate: parseSettingsRate(formData.get("loanWithdrawalFeeRate")),
    loanMaxDurationMonths: Number(formData.get("loanMaxDurationMonths")),
    maxMembers: Number(formData.get("maxMembers")),
    year: Number(formData.get("year")),
    cashOpeningBalance: Number(formData.get("cashOpeningBalance")),
    organizationName: String(formData.get("organizationName") || "Solidarité Plus"),
  });
  if (!parsed.success) return { error: "Données invalides. Vérifiez les champs." };

  await settingsRepo.save(parsed.data);
  await audit("settings.update");
  revalidatePath("/admin/parametres");
  revalidatePath("/gestion");
  revalidatePath("/gestion/parametres");
  revalidatePath("/gestion/prets");
  return { ok: true };
}

export async function saveMemberAction(formData: FormData) {
  await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);

  const parsed = memberSchema.safeParse({
    id: formData.get("id") || undefined,
    lastName: formData.get("lastName"),
    firstName: formData.get("firstName"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    sex: formData.get("sex") || "",
    cip: formData.get("cip") || undefined,
    birthDate: formData.get("birthDate") || undefined,
    joinedAt: formData.get("joinedAt") || undefined,
    address: formData.get("address") || undefined,
    profession: formData.get("profession") || undefined,
    sponsor: formData.get("sponsor") || undefined,
    notes: formData.get("notes") || undefined,
    origin: formData.get("origin") || undefined,
    emergencyContact: formData.get("emergencyContact") || undefined,
  });
  if (!parsed.success) return;

  const data = parsed.data;

  if (data.id) {
    await globalMembersRepo.update((items) =>
      items.map((m) =>
        m.id === data.id
          ? {
              ...m,
              ...data,
              id: data.id!,
              joinedAt: data.joinedAt || m.joinedAt,
              email: data.email || undefined,
            }
          : m
      )
    );
    await audit("member.update", `${data.lastName} ${data.firstName}`);
    revalidatePath("/gestion/membres");
    return;
  }

  const year = new Date().getFullYear();
  await globalMembersRepo.update((items) => {
    const seq = String(items.length + 1).padStart(3, "0");
    const created: Member = {
      id: `TSP-${year}-${seq}`,
      lastName: data.lastName,
      firstName: data.firstName,
      phone: data.phone,
      email: data.email || undefined,
      sex: data.sex,
      cip: data.cip,
      birthDate: data.birthDate,
      joinedAt: data.joinedAt || new Date().toISOString().slice(0, 10),
      address: data.address,
      profession: data.profession,
      sponsor: data.sponsor,
      notes: data.notes,
      origin: data.origin,
      emergencyContact: data.emergencyContact,
    };
    return [...items, created];
  });

  await audit("member.create", `${data.lastName} ${data.firstName}`);
  revalidatePath("/gestion/membres");
  return;
}

/**
 * Retire le membre de l’annuaire global.
 * S’il était inscrit à des tontines, une copie d’identité est figée sur chaque inscription
 * pour conserver l’historique (cotisations, prêts, etc.).
 */
export async function deleteMemberAction(formData: FormData) {
  await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const memberId = String(formData.get("memberId") || "").trim();
  if (!memberId) return;

  const members = await globalMembersRepo.all();
  const member = members.find((m) => m.id === memberId);
  if (!member) return;

  const snapshot: MemberSnapshot = {
    lastName: member.lastName,
    firstName: member.firstName,
    phone: member.phone,
    email: member.email,
    sex: member.sex,
    cip: member.cip,
    birthDate: member.birthDate,
    address: member.address,
    profession: member.profession,
    sponsor: member.sponsor,
    notes: member.notes,
    origin: member.origin,
    emergencyContact: member.emergencyContact,
  };
  const removedAt = new Date().toISOString();

  const meta = await readMeta();
  for (const period of meta.periods) {
    const enrollments = await readCollectionForPeriodId<Enrollment>(period.id, "enrollments");
    let changed = false;
    const next = enrollments.map((e) => {
      if (e.memberId !== memberId) return e;
      changed = true;
      return {
        ...e,
        memberSnapshot: snapshot,
        removedFromDirectoryAt: removedAt,
      };
    });
    if (changed) {
      await writeCollectionForPeriod(period, "enrollments", next);
    }
  }

  await globalMembersRepo.update((items) => items.filter((m) => m.id !== memberId));

  await usersRepo.update((items) =>
    items.map((u) => (u.memberId === memberId ? { ...u, memberId: null } : u))
  );

  await audit("member.delete", `${member.lastName} ${member.firstName}`);
  revalidatePath("/gestion/membres");
  revalidatePath("/gestion");
  revalidatePath("/gestion/cotisations");
  revalidatePath("/gestion/prets");
  revalidatePath("/admin/utilisateurs");
  return;
}

/** Inscrit un membre de l’annuaire à une tontine choisie (inscriptions ouvertes). */
export async function enrollMemberAction(formData: FormData) {
  await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const memberId = String(formData.get("memberId") || "").trim();
  const periodId = String(formData.get("periodId") || "").trim();
  if (!memberId || !periodId) return;

  const settings = await settingsRepo.get();
  const enrollmentParsed = enrollmentFieldsSchema.safeParse({
    status: formData.get("status") || "Actif",
    weeklyTarget: Number(formData.get("weeklyTarget") || settings.contributionMin),
  });
  if (!enrollmentParsed.success) return;

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period || period.status === "closed" || period.enrollmentsOpen === false) return;

  const members = await globalMembersRepo.all();
  const member = members.find((m) => m.id === memberId);
  if (!member) return;

  const enrollments = await readCollectionForPeriodId<Enrollment>(periodId, "enrollments");
  if (enrollments.some((e) => e.memberId === memberId)) return;

  const enrollment: Enrollment = {
    id: newId("ENR"),
    memberId,
    joinedAt: new Date().toISOString().slice(0, 10),
    status: enrollmentParsed.data.status,
    weeklyTarget: enrollmentParsed.data.weeklyTarget,
  };
  await writeCollectionForPeriod(period, "enrollments", [...enrollments, enrollment]);
  await audit("member.enroll", `${member.lastName} ${member.firstName} → ${period.name}`);
  revalidatePath("/gestion/membres");
  return;
}

export async function addWeekAction(formData: FormData) {
  await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const periodId = String(formData.get("periodId") || "").trim();
  const parsed = weekInputSchema.safeParse({
    date: formData.get("date"),
    label: formData.get("label") || undefined,
  });
  if (!parsed.success || !periodId) return;
  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return;

  const d = new Date(parsed.data.date);
  const weeks = await readCollectionForPeriodId<{ id: string; date: string; label: string; month: number; year: number }>(
    periodId,
    "weeks"
  );
  if (weeks.some((w) => w.date === parsed.data.date)) {
    revalidatePath("/gestion/cotisations");
    return;
  }
  await writeCollectionForPeriod(period, "weeks", [
    ...weeks,
    {
      id: newId("WEEK"),
      date: parsed.data.date,
      label: parsed.data.label || d.toLocaleDateString("fr-FR"),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    },
  ].sort((a, b) => a.date.localeCompare(b.date)));
  revalidatePath("/gestion/cotisations");
  return;
}

export type SaveContributionResult =
  | { ok: true; amount: number; locked: boolean }
  | { ok: false; error?: string };

export async function saveContributionAction(
  formData: FormData
): Promise<SaveContributionResult> {
  const session = await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const periodId = String(formData.get("periodId") || "").trim();
  const parsed = contributionInputSchema.safeParse({
    memberId: formData.get("memberId"),
    weekId: formData.get("weekId"),
    amount: Number(formData.get("amount")),
  });
  if (!parsed.success || !periodId) return { ok: false, error: "Données invalides." };
  try {
    const result = await upsertContribution({
      ...parsed.data,
      periodId,
      recordedBy: session.user.id,
    });
    return {
      ok: true,
      amount: result.amount,
      locked: result.amount > 0 && result.locked !== false,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Enregistrement impossible.",
    };
  }
}

export type UnlockContributionState = { error?: string; ok?: boolean } | null;

export async function unlockContributionAction(
  _prev: UnlockContributionState,
  formData: FormData
): Promise<UnlockContributionState> {
  await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const periodId = String(formData.get("periodId") || "").trim();
  const memberId = String(formData.get("memberId") || "").trim();
  const weekId = String(formData.get("weekId") || "").trim();
  const password = String(formData.get("password") || "");
  if (!periodId || !memberId || !weekId) return { error: "Données manquantes." };
  if (!password) return { error: "Mot de passe requis." };

  const ok = await verifySessionPassword(password);
  if (!ok) return { error: "Mot de passe incorrect." };

  try {
    await unlockContribution({ periodId, memberId, weekId });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Déverrouillage impossible." };
  }

  // Pas de revalidatePath : la grille met à jour l'état local (évite le jump scroll).
  return { ok: true };
}

export type ApplyLateReportState =
  | { error?: string; created?: number; ok?: true }
  | null;

/** Applique les pénalités de retard pour une séance (idempotent), puis le client copie le rapport. */
export async function applyLateReportPenaltiesAction(
  _prev: ApplyLateReportState,
  formData: FormData
): Promise<ApplyLateReportState> {
  const session = await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const periodId = String(formData.get("periodId") || "").trim();
  const weekId = String(formData.get("weekId") || "").trim();
  if (!periodId || !weekId) return { error: "Données manquantes." };

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return { error: "Tontine introuvable." };

  const weeks = await readCollectionForPeriodId<{ id: string; date: string }>(periodId, "weeks");
  const week = weeks.find((w) => w.id === weekId);
  if (!week) return { error: "Séance introuvable." };

  const settings = await readObjectForPeriodId(periodId, "settings", DEFAULT_SETTINGS);

  try {
    const created = await applyLatePenaltiesForWeek({
      period,
      weekId,
      weekDate: week.date,
      recordedBy: session.user.id,
      penaltyAmount: settings.penaltyLateContribution,
    });
    revalidatePath("/gestion/cotisations");
    revalidatePath("/gestion/penalites");
    return { ok: true, created };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Pénalités impossibles." };
  }
}

export async function createLoanAction(formData: FormData) {
  const session = await requireGestionWrite();
  const periodId = String(formData.get("periodId") || "").trim();
  const parsed = loanInputSchema.safeParse({
    memberId: formData.get("memberId"),
    date: formData.get("date"),
    amount: Number(formData.get("amount")),
    dueDate: formData.get("dueDate"),
    witnessName: formData.get("witnessName") || undefined,
    witnessPhone: formData.get("witnessPhone") || undefined,
    witnessAddress: formData.get("witnessAddress") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success || !periodId) return;

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return;

  const users = await usersRepo.all();
  let requiredApproverIds = users
    .filter((u) => u.active && isLoanQuorumRole(u.role))
    .map((u) => u.id);
  if (requiredApproverIds.length === 0) {
    requiredApproverIds = users.filter((u) => u.active && u.role === "SUPER_ADMIN").map((u) => u.id);
  }
  if (requiredApproverIds.length === 0) return;

  const settings = await readObjectForPeriodId(periodId, "settings", DEFAULT_SETTINGS);
  const figures = computeLoanFigures(parsed.data.amount, settings);
  const year = settings.year;
  const existing = await readCollectionForPeriodId<Loan>(periodId, "loans");
  const seq = String(existing.length + 1).padStart(3, "0");

  const loan: Loan = {
    id: `PRE-${year}-${seq}`,
    memberId: parsed.data.memberId,
    date: parsed.data.date,
    amount: parsed.data.amount,
    withdrawalFee: figures.withdrawalFee,
    witnessName: parsed.data.witnessName,
    witnessPhone: parsed.data.witnessPhone,
    witnessAddress: parsed.data.witnessAddress,
    dueDate: parsed.data.dueDate,
    interestMonth1: figures.interestMonth1,
    interestMonth2: figures.interestMonth2,
    interestExtra: 0,
    totalDue: figures.totalDue,
    repaid: 0,
    status: "En attente",
    notes: parsed.data.notes,
    createdBy: session.user.id,
    createdAt: new Date().toISOString(),
    requiredApproverIds,
    approvals: [],
    disbursedAt: null,
  };

  await writeCollectionForPeriod(period, "loans", [...existing, loan]);
  await audit("loan.create", `${loan.id} (en attente)`);
  revalidatePath("/gestion/prets");
  revalidatePath("/gestion");
  return;
}

export async function decideLoanAction(formData: FormData) {
  const session = await requireLoanApprover();
  const periodId = String(formData.get("periodId") || "").trim();
  const loanId = String(formData.get("loanId") || "").trim();
  const decision = String(formData.get("decision") || "").trim();
  const note = String(formData.get("note") || "").trim() || undefined;
  if (!periodId || !loanId || (decision !== "approved" && decision !== "rejected")) return;

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return;

  const loans = await readCollectionForPeriodId<Loan>(periodId, "loans");
  const idx = loans.findIndex((l) => l.id === loanId);
  if (idx < 0) return;
  const loan = loans[idx];
  if (loan.status !== "En attente") return;

  const required = loan.requiredApproverIds ?? [];
  const canVote =
    session.user.role === "SUPER_ADMIN" ||
    required.includes(session.user.id);
  if (!canVote) return;

  const approvals = [...(loan.approvals ?? [])];
  if (approvals.some((a) => a.userId === session.user.id)) return;

  approvals.push({
    userId: session.user.id,
    userName: session.user.name,
    decision,
    at: new Date().toISOString(),
    note,
  });

  let next: Loan = { ...loan, approvals };

  if (decision === "rejected") {
    next = { ...next, status: "Refusé" };
    const copy = [...loans];
    copy[idx] = next;
    await writeCollectionForPeriod(period, "loans", copy);
    await audit("loan.reject", loanId);
    revalidatePath("/gestion/prets");
    return;
  }

  const approvedIds = new Set(
    approvals.filter((a) => a.decision === "approved").map((a) => a.userId)
  );
  // Super admin approval counts for themselves if in required list; also allows completing when all gestionnaires approved
  const allApproved = required.every((id) => approvedIds.has(id));

  if (allApproved) {
    const now = new Date().toISOString();
    next = { ...next, status: "En cours", disbursedAt: now };
    const copy = [...loans];
    copy[idx] = next;
    await writeCollectionForPeriod(period, "loans", copy);
    await appendCashEntry({
      date: loan.date,
      type: "Sortie",
      description: `Prêt ${loan.id}`,
      amount: loan.amount + loan.withdrawalFee,
      reference: loan.id,
      origin: "Prêt octroyé",
      recordedBy: session.user.name,
      periodId,
    });
    await audit("loan.disburse", loanId);
    revalidatePath("/gestion/prets");
    revalidatePath("/gestion/caisse");
    revalidatePath("/gestion");
    return;
  }

  const copy = [...loans];
  copy[idx] = next;
  await writeCollectionForPeriod(period, "loans", copy);
  await audit("loan.approve", loanId);
  revalidatePath("/gestion/prets");
  return;
}

export async function createRepaymentAction(formData: FormData) {
  const session = await requireGestionWrite();
  const periodId = String(formData.get("periodId") || "").trim();
  const parsed = repaymentInputSchema.safeParse({
    loanId: formData.get("loanId"),
    date: formData.get("date"),
    amount: Number(formData.get("amount")),
  });
  if (!parsed.success || !periodId) return;

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return;

  const loans = await readCollectionForPeriodId<Loan>(periodId, "loans");
  const loan = loans.find((l) => l.id === parsed.data.loanId);
  if (!loan || loan.status === "Remboursé" || loan.status === "En attente" || loan.status === "Refusé") {
    return;
  }

  const remaining = loanRemaining(loan);
  const amount = Math.min(parsed.data.amount, remaining);
  if (amount <= 0) return;

  const interestLeft =
    loan.interestMonth1 + loan.interestMonth2 + loan.interestExtra -
    Math.min(loan.repaid, loan.interestMonth1 + loan.interestMonth2 + loan.interestExtra);
  const interest = Math.min(amount, Math.max(0, interestLeft));
  const capital = amount - interest;
  const newRepaid = loan.repaid + amount;
  const rem = Math.max(0, loan.totalDue - newRepaid);

  const repayments = await readCollectionForPeriodId<Repayment>(periodId, "repayments");
  await writeCollectionForPeriod(period, "repayments", [
    ...repayments,
    {
      id: newId("REM"),
      loanId: loan.id,
      date: parsed.data.date,
      amount,
      capital,
      interest,
      remainingBalance: rem,
      recordedBy: session.user.id,
      createdAt: new Date().toISOString(),
    },
  ]);

  await writeCollectionForPeriod(
    period,
    "loans",
    loans.map((l) =>
      l.id === loan.id
        ? {
            ...l,
            repaid: newRepaid,
            status: rem <= 0 ? ("Remboursé" as const) : ("En cours" as const),
          }
        : l
    )
  );

  await appendCashEntry({
    date: parsed.data.date,
    type: "Entrée",
    description: `Remboursement ${loan.id}`,
    amount,
    reference: loan.id,
    origin: "Remboursement",
    recordedBy: session.user.name,
    periodId,
  });

  await audit("repayment.create", `${loan.id}: ${amount}`);
  revalidatePath("/gestion/remboursements");
  revalidatePath("/gestion/prets");
  revalidatePath("/gestion/caisse");
  revalidatePath("/gestion");
  return;
}

export async function createPenaltyAction(formData: FormData) {
  const session = await requireGestionWrite();
  const periodId = String(formData.get("periodId") || "").trim();
  if (!periodId) return;

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return;

  const settings = await readObjectForPeriodId(periodId, "settings", DEFAULT_SETTINGS);
  const motif = String(formData.get("motif") || "autre");
  let amount = Number(formData.get("amount"));
  if (!amount) {
    if (motif === "retard_cotisation") amount = settings.penaltyLateContribution;
    if (motif === "absence_reunion") amount = settings.penaltyAbsence;
  }
  const parsed = penaltyInputSchema.safeParse({
    memberId: formData.get("memberId"),
    date: formData.get("date"),
    motif,
    motifLabel: formData.get("motifLabel") || motif,
    amount,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return;

  const penalties = await readCollectionForPeriodId<Penalty>(periodId, "penalties");
  await writeCollectionForPeriod(period, "penalties", [
    ...penalties,
    {
      id: newId("PEN"),
      ...parsed.data,
      paid: false,
      paidAt: null,
      recordedBy: session.user.id,
      createdAt: new Date().toISOString(),
    },
  ]);
  await audit("penalty.create", parsed.data.memberId);
  revalidatePath("/gestion/penalites");
  revalidatePath("/gestion");
  revalidatePath("/membre");
  return;
}

export async function markPenaltyPaidAction(formData: FormData) {
  const session = await requireGestionWrite();
  const id = String(formData.get("id") || "");
  const periodId = String(formData.get("periodId") || "").trim();
  if (!id || !periodId) return;

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return;

  const penalties = await readCollectionForPeriodId<Penalty>(periodId, "penalties");
  const target = penalties.find((p) => p.id === id);
  if (!target || target.paid) return;

  await writeCollectionForPeriod(
    period,
    "penalties",
    penalties.map((p) =>
      p.id === id ? { ...p, paid: true, paidAt: new Date().toISOString() } : p
    )
  );

  if (target.amount > 0) {
    await appendCashEntry({
      date: new Date().toISOString().slice(0, 10),
      type: "Entrée",
      description: `Pénalité payée ${id}`,
      amount: target.amount,
      reference: id,
      origin: "Pénalité",
      recordedBy: session.user.name,
      periodId,
    });
  }

  revalidatePath("/gestion/penalites");
  revalidatePath("/gestion/caisse");
  revalidatePath("/gestion");
  return;
}

export async function createCashEntryAction(formData: FormData) {
  const session = await requireGestionWrite();
  const periodId = String(formData.get("periodId") || "").trim();
  if (!periodId) return;

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return;

  const parsed = cashInputSchema.safeParse({
    date: formData.get("date"),
    type: formData.get("type"),
    description: formData.get("description"),
    amount: Number(formData.get("amount")),
    reference: formData.get("reference") || undefined,
    origin: formData.get("origin") || undefined,
  });
  if (!parsed.success) return;

  await appendCashEntry({
    ...parsed.data,
    recordedBy: session.user.name,
    periodId,
  });
  revalidatePath("/gestion/caisse");
  revalidatePath("/gestion");
  return;
}


export async function createPeriodAction(formData: FormData) {
  await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("startDate") || "").trim();
  const endDate = String(formData.get("endDate") || "").trim();
  const periodicityType = String(formData.get("periodicityType") || "weekday");

  let periodicity: Periodicity;
  if (periodicityType === "every_n_days") {
    periodicity = {
      type: "every_n_days",
      intervalDays: Number(formData.get("intervalDays") || 10),
    };
  } else {
    periodicity = {
      type: "weekday",
      weekday: Number(formData.get("weekday") || 0) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    };
  }

  const parsed = createPeriodSchema.safeParse({ name, startDate, endDate, periodicity });
  if (!parsed.success) return;

  const period = await createPeriod({ ...parsed.data, makeActive: true });
  const jar = await cookies();
  jar.set(PERIOD_COOKIE, period.id, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/gestion");
  revalidatePath("/gestion/parametres");
  revalidatePath("/gestion/membres");
  const redirectTo = String(formData.get("redirectTo") || GESTION_PARAMETRES);
  redirect(redirectTo);
}

export type PasswordConfirmState = { error?: string } | null;

export async function closeEnrollmentsAction(
  _prev: PasswordConfirmState,
  formData: FormData
): Promise<PasswordConfirmState> {
  await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const periodId = String(formData.get("periodId") || "");
  const password = String(formData.get("password") || "");
  if (!periodId) return { error: "Tontine manquante." };
  if (!password) return { error: "Mot de passe requis." };

  const ok = await verifySessionPassword(password);
  if (!ok) return { error: "Mot de passe incorrect." };

  try {
    await closeEnrollments(periodId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Clôture impossible." };
  }

  await audit("period.close_enrollments", periodId);
  revalidatePath("/gestion");
  revalidatePath("/gestion/parametres");
  revalidatePath("/gestion/membres");
  redirect(GESTION_PARAMETRES);
}

export async function selectPeriodAction(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "GESTIONNAIRE", "MEMBRE"]);
  const periodId = String(formData.get("periodId") || "");
  if (!periodId) return;
  if (session.user.role === "SUPER_ADMIN" || session.user.role === "GESTIONNAIRE") {
    await setActivePeriod(periodId);
  }
  const jar = await cookies();
  jar.set(PERIOD_COOKIE, periodId, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/");
  revalidatePath("/gestion/parametres");
  redirect(String(formData.get("redirectTo") || GESTION_PARAMETRES));
}

export async function closePeriodAction(
  _prev: PasswordConfirmState,
  formData: FormData
): Promise<PasswordConfirmState> {
  await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const periodId = String(formData.get("periodId") || "");
  const password = String(formData.get("password") || "");
  if (!periodId) return { error: "Tontine manquante." };
  if (!password) return { error: "Mot de passe requis." };

  const ok = await verifySessionPassword(password);
  if (!ok) return { error: "Mot de passe incorrect." };

  try {
    await closePeriod(periodId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Clôture impossible." };
  }

  const jar = await cookies();
  if (jar.get(PERIOD_COOKIE)?.value === periodId) {
    jar.delete(PERIOD_COOKIE);
  }

  await audit("period.close", periodId);
  revalidatePath("/gestion");
  revalidatePath("/gestion/parametres");
  redirect(GESTION_PARAMETRES);
}

export type DeletePeriodState = { error?: string } | null;

export async function deletePeriodAction(
  _prev: DeletePeriodState,
  formData: FormData
): Promise<DeletePeriodState> {
  await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const periodId = String(formData.get("periodId") || "");
  const password = String(formData.get("password") || "");
  if (!periodId) return { error: "Tontine manquante." };
  if (!password) return { error: "Mot de passe requis." };

  const ok = await verifySessionPassword(password);
  if (!ok) return { error: "Mot de passe incorrect." };

  try {
    await deletePeriod(periodId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Suppression impossible." };
  }

  const jar = await cookies();
  if (jar.get(PERIOD_COOKIE)?.value === periodId) {
    jar.delete(PERIOD_COOKIE);
  }

  try {
    await audit("period.delete", periodId);
  } catch {
    /* pas de période active pour écrire l’audit */
  }

  revalidatePath("/gestion");
  revalidatePath("/gestion/parametres");
  redirect(GESTION_PARAMETRES);
}

export type UpdateWithdrawalFeeState = { error?: string; ok?: boolean } | null;

/** Met à jour le taux de frais de retrait prêt (paramètre tontine), avec MDP. */
export async function updateLoanWithdrawalFeeAction(
  _prev: UpdateWithdrawalFeeState,
  formData: FormData
): Promise<UpdateWithdrawalFeeState> {
  await requireGestionWrite();
  const periodId = String(formData.get("periodId") || "").trim();
  const password = String(formData.get("password") || "");
  const rawRate = String(formData.get("loanWithdrawalFeeRate") || "").trim();
  if (!periodId) return { error: "Tontine manquante." };
  if (!password) return { error: "Mot de passe requis." };

  // Accepte 0.02 ou 2 (pourcent)
  let rate = Number(rawRate.replace(",", "."));
  if (!Number.isFinite(rate) || rate < 0) return { error: "Taux invalide." };
  if (rate > 1) rate = rate / 100;
  if (rate > 1) return { error: "Taux trop élevé (max 100 %)." };

  const ok = await verifySessionPassword(password);
  if (!ok) return { error: "Mot de passe incorrect." };

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return { error: "Tontine introuvable." };

  const settings = await readObjectForPeriodId(periodId, "settings", DEFAULT_SETTINGS);
  await writeObjectForPeriodId(periodId, "settings", {
    ...settings,
    loanWithdrawalFeeRate: rate,
  });

  await audit("settings.loan_withdrawal_fee", `${periodId}: ${rate}`);
  revalidatePath("/gestion/parametres");
  revalidatePath("/gestion/prets");
  revalidatePath("/gestion");
  return { ok: true };
}
