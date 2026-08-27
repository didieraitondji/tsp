"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auditRepo, globalMembersRepo, listEnrolledForPeriod, settingsRepo, usersRepo } from "@/lib/db/collections";
import {
  addMonthsIso,
  appendCashEntry,
  applyLatePenaltiesForWeek,
  CASH_ORIGIN_LOAN,
  CASH_ORIGIN_PENALTY,
  CASH_ORIGIN_REPAYMENT,
  completeLateMonths,
  computeLoanFigures,
  computeLoanInterestAsOf,
  loanAccruedNormalMonths,
  loanContractedMonths,
  loanRemaining,
  markContributionStatus,
  newId,
  reconcileLateLoanInterest,
  removeCashEntriesByReference,
  unlockContribution,
  upsertContribution,
} from "@/lib/db/domain";
import { todayIsoLocal } from "@/lib/cotisations-report";
import {
  requireGestionWrite,
  requireLoanApprover,
  requireLoanInitiator,
  requireRole,
  requireSession,
} from "@/lib/auth/session";
import { isLoanQuorumRole } from "@/lib/auth/permissions";
import {
  cashInputSchema,
  createPeriodSchema,
  createUserSchema,
  contributionInputSchema,
  markContributionSchema,
  enrollmentFieldsSchema,
  loanInputSchema,
  memberSchema,
  penaltyInputSchema,
  repaymentInputSchema,
  settingsSchema,
  updateLoanSchema,
  updateUserSchema,
  weekInputSchema,
} from "@/lib/schemas";
import type { Enrollment, Loan, LoanWitness, Member, MemberSnapshot, Penalty, Periodicity, Repayment, User } from "@/lib/types";
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
  if (data.role === "MEMBRE" && !data.memberId) return;
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
    memberId: data.memberId || null,
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

export type UserActionState = { error?: string; ok?: boolean } | null;

export async function updateUserAction(formData: FormData): Promise<UserActionState> {
  await requireRole(["SUPER_ADMIN"]);
  const parsed = updateUserSchema.safeParse({
    id: formData.get("id"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password") || undefined,
    name: formData.get("name") || undefined,
    role: formData.get("role") || undefined,
    memberId: formData.has("memberId") ? formData.get("memberId") || null : undefined,
    active: formData.has("active") ? formData.get("active") === "true" : undefined,
    email: formData.has("email") ? String(formData.get("email") || "") : undefined,
  });
  if (!parsed.success) return { error: "Données invalides." };

  const data = parsed.data;
  if ((data.role ?? undefined) === "MEMBRE" && data.memberId !== undefined && !data.memberId) {
    return { error: "Un compte Membre doit être lié à un membre de l’annuaire." };
  }
  const phone = data.phone ? normalizePhone(data.phone) : undefined;
  if (data.phone && !phone) return { error: "Téléphone invalide." };

  let conflict = false;
  let notFound = false;
  let syncedMemberId: string | null = null;
  let nextPhoneForMember: string | null = null;
  let nextEmailForMember: string | null | undefined = undefined;

  await usersRepo.update(async (items) => {
    if (phone && items.some((u) => u.id !== data.id && phonesMatch(u.phone, phone))) {
      conflict = true;
      return items;
    }
    const idx = items.findIndex((u) => u.id === data.id);
    if (idx < 0) {
      notFound = true;
      return items;
    }
    const current = items[idx];
    const nextRole = data.role ?? current.role;
    const email =
      data.email !== undefined
        ? data.email.trim()
          ? data.email.trim().toLowerCase()
          : null
        : current.email;
    const next: User = {
      ...current,
      phone: phone ?? current.phone,
      name: data.name ?? current.name,
      role: nextRole,
      memberId:
        data.memberId !== undefined
          ? data.memberId || null
          : current.memberId,
      active: data.active ?? current.active,
      email,
      passwordHash: data.password
        ? await bcrypt.hash(data.password, 10)
        : current.passwordHash,
      ...(data.password
        ? { mustChangePassword: true }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    syncedMemberId = next.memberId ?? null;
    nextPhoneForMember = next.phone;
    if (data.email !== undefined) nextEmailForMember = next.email ?? null;
    const copy = [...items];
    copy[idx] = next;
    return copy;
  });
  if (conflict) return { error: "Ce numéro est déjà utilisé." };
  if (notFound) return { error: "Compte introuvable." };

  // Compte lié à une fiche → aligner téléphone (et email) dans l’annuaire
  if (syncedMemberId && nextPhoneForMember) {
    await globalMembersRepo.update((items) =>
      items.map((m) => {
        if (m.id !== syncedMemberId) return m;
        return {
          ...m,
          phone: nextPhoneForMember!,
          ...(nextEmailForMember !== undefined
            ? { email: nextEmailForMember || undefined }
            : {}),
        };
      })
    );
    revalidatePath("/gestion/membres");
    revalidatePath("/membre/profil");
  }

  await audit("user.update", data.id);
  revalidatePath("/admin/utilisateurs");
  return { ok: true };
}

export async function deleteUserAction(formData: FormData): Promise<UserActionState> {
  await requireRole(["SUPER_ADMIN"]);
  const id = String(formData.get("id") || "").trim();
  if (!id) return { error: "Compte manquant." };

  const session = await requireSession();
  if (session.user.id === id) {
    return { error: "Vous ne pouvez pas supprimer votre propre compte." };
  }

  let blockedLastAdmin = false;
  let notFound = false;
  await usersRepo.update((items) => {
    const target = items.find((u) => u.id === id);
    if (!target) {
      notFound = true;
      return items;
    }
    if (target.role === "SUPER_ADMIN") {
      const otherAdmins = items.filter(
        (u) => u.id !== id && u.role === "SUPER_ADMIN" && u.active
      );
      if (otherAdmins.length === 0) {
        blockedLastAdmin = true;
        return items;
      }
    }
    return items.filter((u) => u.id !== id);
  });

  if (notFound) return { error: "Compte introuvable." };
  if (blockedLastAdmin) {
    return { error: "Impossible de supprimer le dernier super admin actif." };
  }

  await audit("user.delete", id);
  revalidatePath("/admin/utilisateurs");
  return { ok: true };
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
  await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
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
    loanSecondWitnessThreshold: Number(
      formData.get("loanSecondWitnessThreshold") ??
        DEFAULT_SETTINGS.loanSecondWitnessThreshold
    ),
    maxMembers: Number(formData.get("maxMembers")),
    year: Number(formData.get("year")),
    cashOpeningBalance: Number(formData.get("cashOpeningBalance")),
    organizationName: String(formData.get("organizationName") || "Solidarité Plus"),
    requirePasswordToUnlockContribution:
      formData.get("requirePasswordToUnlockContribution") === "on",
    depositPhone1: String(formData.get("depositPhone1") || ""),
    depositName1: String(formData.get("depositName1") || ""),
    depositPhone2: String(formData.get("depositPhone2") || ""),
    depositName2: String(formData.get("depositName2") || ""),
  });
  if (!parsed.success) return { error: "Données invalides. Vérifiez les champs." };

  const periodId = String(formData.get("periodId") || "").trim();
  if (periodId) {
    const meta = await readMeta();
    const period = meta.periods.find((p) => p.id === periodId);
    if (!period) return { error: "Tontine introuvable." };
    await writeObjectForPeriodId(periodId, "settings", parsed.data);
    await audit("settings.update", period.name);
  } else {
    await settingsRepo.save(parsed.data);
    await audit("settings.update");
  }

  revalidatePath("/admin/parametres");
  revalidatePath("/gestion");
  revalidatePath("/gestion/parametres");
  revalidatePath("/gestion/cotisations");
  revalidatePath("/gestion/prets");
  revalidatePath("/membre");
  revalidatePath("/membre/cotisations");
  return { ok: true };
}

export type MemberActionState = { error?: string; ok?: boolean } | null;

function nextSequentialId(
  existingIds: string[],
  prefix: string,
  pad = 3
): string {
  let max = 0;
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(pad, "0")}`;
}

export async function saveMemberAction(formData: FormData): Promise<MemberActionState> {
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
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return { error: msg || "Données invalides." };
  }

  const data = parsed.data;
  const createAccount =
    formData.get("createAccount") === "on" || formData.get("createAccount") === "true";

  async function ensureMemberAccount(member: Member): Promise<MemberActionState> {
    const users = await usersRepo.all();
    if (users.some((u) => u.memberId === member.id)) {
      return { ok: true };
    }
    if (!member.phone) {
      return { error: "Téléphone requis pour créer le compte membre." };
    }
    const accountPhone = normalizePhone(member.phone);
    if (!accountPhone) {
      return { error: "Téléphone invalide." };
    }
    if (users.some((u) => phonesMatch(u.phone, accountPhone))) {
      return {
        error:
          "Un compte existe déjà avec ce numéro. Désactivez la création de compte ou changez le téléphone.",
      };
    }

    const { DEFAULT_TEMP_PASSWORD } = await import("@/lib/auth/constants");
    const now = new Date().toISOString();
    const user: User = {
      id: newId("USR"),
      phone: accountPhone,
      passwordHash: await bcrypt.hash(DEFAULT_TEMP_PASSWORD, 10),
      name: `${member.lastName} ${member.firstName}`.trim(),
      role: "MEMBRE",
      memberId: member.id,
      active: true,
      email: member.email?.trim() ? member.email.trim().toLowerCase() : null,
      mustChangePassword: true,
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await usersRepo.update((items) => [...items, user]);
      await audit("user.create", `${user.phone} (MEMBRE, auto)`);
      revalidatePath("/admin/utilisateurs");
      return { ok: true };
    } catch (e) {
      console.error("saveMemberAction createAccount", e);
      return {
        error:
          "Le compte n’a pas pu être créé (conflit possible). Créez-le depuis Comptes & rôles.",
      };
    }
  }

  /** Aligne téléphone (et nom/email pour rôle MEMBRE) sur tous les comptes liés à la fiche. */
  async function syncLinkedMemberAccount(member: Member): Promise<MemberActionState> {
    const users = await usersRepo.all();
    const linkedUsers = users.filter((u) => u.memberId === member.id);
    if (linkedUsers.length === 0) return { ok: true };

    const nextPhone = member.phone ? normalizePhone(member.phone) : "";
    if (member.phone && !nextPhone) {
      return { error: "Téléphone invalide pour le compte lié." };
    }
    if (!nextPhone) {
      return {
        error:
          "Un compte est lié à cette fiche : le téléphone est obligatoire. Indiquez le numéro ou détachez le compte.",
      };
    }

    const linkedIds = new Set(linkedUsers.map((u) => u.id));
    if (users.some((u) => !linkedIds.has(u.id) && phonesMatch(u.phone, nextPhone))) {
      return {
        error:
          "Impossible de mettre à jour le compte : un autre utilisateur utilise déjà ce numéro.",
      };
    }

    const memberDisplayName = `${member.lastName} ${member.firstName}`.trim();
    const nextEmail = member.email?.trim()
      ? member.email.trim().toLowerCase()
      : undefined;

    const now = new Date().toISOString();
    let changed = false;
    await usersRepo.update((items) =>
      items.map((u) => {
        if (u.memberId !== member.id) return u;
        const phoneChanged = !phonesMatch(u.phone, nextPhone);
        // Nom / email : seulement pour le rôle MEMBRE (le libellé gestionnaire reste libre)
        const syncProfile = u.role === "MEMBRE";
        const nextName = syncProfile ? memberDisplayName : u.name;
        const resolvedEmail = syncProfile
          ? nextEmail !== undefined
            ? nextEmail
            : u.email
          : u.email;
        const nameChanged = syncProfile && u.name !== nextName;
        const emailChanged =
          syncProfile && (u.email || null) !== (resolvedEmail || null);
        if (!phoneChanged && !nameChanged && !emailChanged) return u;
        changed = true;
        return {
          ...u,
          phone: nextPhone,
          name: nextName,
          email: resolvedEmail ?? null,
          updatedAt: now,
        };
      })
    );

    if (changed) {
      await audit("user.update", `sync fiche ${member.id} → ${nextPhone}`);
      revalidatePath("/admin/utilisateurs");
      revalidatePath("/membre/profil");
    }
    return { ok: true };
  }

  if (data.id) {
    const existing = (await globalMembersRepo.all()).find((m) => m.id === data.id);
    if (!existing) return { error: "Membre introuvable." };

    const updated: Member = {
      ...existing,
      ...data,
      id: data.id,
      joinedAt: data.joinedAt || existing.joinedAt,
      email: data.email || undefined,
    };

    if (createAccount) {
      const users = await usersRepo.all();
      const alreadyHas = users.some((u) => u.memberId === data.id);
      if (!alreadyHas) {
        if (!updated.phone) {
          return { error: "Téléphone requis pour créer le compte membre." };
        }
        const accountPhone = normalizePhone(updated.phone);
        if (!accountPhone) {
          return { error: "Téléphone invalide." };
        }
        if (users.some((u) => phonesMatch(u.phone, accountPhone))) {
          return {
            error:
              "Un compte existe déjà avec ce numéro. Désactivez la création de compte ou changez le téléphone.",
          };
        }
      }
    }

    // Pré-contrôle sync comptes liés
    {
      const users = await usersRepo.all();
      const linkedUsers = users.filter((u) => u.memberId === data.id);
      if (linkedUsers.length > 0) {
        const nextPhone = updated.phone ? normalizePhone(updated.phone) : "";
        if (updated.phone && !nextPhone) {
          return { error: "Téléphone invalide pour le compte lié." };
        }
        if (!nextPhone) {
          return {
            error:
              "Un compte est lié à cette fiche : le téléphone est obligatoire.",
          };
        }
        const linkedIds = new Set(linkedUsers.map((u) => u.id));
        if (users.some((u) => !linkedIds.has(u.id) && phonesMatch(u.phone, nextPhone))) {
          return {
            error:
              "Impossible de mettre à jour : un autre utilisateur utilise déjà ce numéro.",
          };
        }
      }
    }

    await globalMembersRepo.update((items) =>
      items.map((m) => (m.id === data.id ? updated : m))
    );
    await audit("member.update", `${data.lastName} ${data.firstName}`);

    const syncResult = await syncLinkedMemberAccount(updated);
    if (syncResult?.error) {
      revalidatePath("/gestion/membres");
      return {
        error: `Membre mis à jour, mais ${syncResult.error.charAt(0).toLowerCase()}${syncResult.error.slice(1)}`,
      };
    }

    if (createAccount) {
      const accountResult = await ensureMemberAccount(updated);
      revalidatePath("/gestion/membres");
      if (accountResult?.error) {
        return {
          error: `Membre mis à jour, mais ${accountResult.error.charAt(0).toLowerCase()}${accountResult.error.slice(1)}`,
        };
      }
      return { ok: true };
    }

    revalidatePath("/gestion/membres");
    return { ok: true };
  }

  if (createAccount) {
    if (!data.phone) {
      return { error: "Téléphone requis pour créer le compte membre." };
    }
    const accountPhone = normalizePhone(data.phone);
    if (!accountPhone) {
      return { error: "Téléphone invalide." };
    }
    const users = await usersRepo.all();
    if (users.some((u) => phonesMatch(u.phone, accountPhone))) {
      return {
        error:
          "Un compte existe déjà avec ce numéro. Désactivez la création de compte ou changez le téléphone.",
      };
    }
  }

  const year = new Date().getFullYear();
  let created: Member | null = null;
  try {
    await globalMembersRepo.update((items) => {
      const id = nextSequentialId(
        items.map((m) => m.id),
        `TSP-${year}-`
      );
      created = {
        id,
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
  } catch (e) {
    console.error("saveMemberAction", e);
    return { error: "Impossible d’enregistrer le membre. Réessayez." };
  }

  if (!created) {
    return { error: "Impossible d’enregistrer le membre. Réessayez." };
  }

  await audit("member.create", `${data.lastName} ${data.firstName}`);

  if (createAccount) {
    const accountResult = await ensureMemberAccount(created as Member);
    revalidatePath("/gestion/membres");
    if (accountResult?.error) {
      return {
        error: `Membre créé, mais ${accountResult.error.charAt(0).toLowerCase()}${accountResult.error.slice(1)}`,
      };
    }
    return { ok: true };
  }

  revalidatePath("/gestion/membres");
  return { ok: true };
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
export async function enrollMemberAction(
  formData: FormData
): Promise<{ ok?: boolean; error?: string; memberId?: string; periodId?: string } | void> {
  await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const memberId = String(formData.get("memberId") || "").trim();
  const periodId = String(formData.get("periodId") || "").trim();
  if (!memberId || !periodId) return { error: "Tontine et membre requis." };

  const settings = await settingsRepo.get();
  const enrollmentParsed = enrollmentFieldsSchema.safeParse({
    status: formData.get("status") || "Actif",
    weeklyTarget: Number(formData.get("weeklyTarget") || settings.contributionMin),
  });
  if (!enrollmentParsed.success) return { error: "Données d’inscription invalides." };

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period || period.status === "closed" || period.enrollmentsOpen === false) {
    return { error: "Cette tontine n’accepte plus d’inscriptions." };
  }

  const members = await globalMembersRepo.all();
  const member = members.find((m) => m.id === memberId);
  if (!member) return { error: "Membre introuvable." };

  const enrollments = await readCollectionForPeriodId<Enrollment>(periodId, "enrollments");
  if (enrollments.some((e) => e.memberId === memberId)) {
    return { error: "Ce membre est déjà inscrit à cette tontine." };
  }

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
  return { ok: true, memberId, periodId };
}

export type UpdateEnrollmentTargetResult =
  | { ok: true; weeklyTarget: number }
  | { ok: false; error?: string };

/** Modifie la mise / cible d’un inscrit. N’altère pas les cotisations déjà marquées. */
export async function updateEnrollmentTargetAction(
  formData: FormData
): Promise<UpdateEnrollmentTargetResult> {
  await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const periodId = String(formData.get("periodId") || "").trim();
  const memberId = String(formData.get("memberId") || "").trim();
  const weeklyTarget = Number(formData.get("weeklyTarget"));
  if (!periodId || !memberId) return { ok: false, error: "Données manquantes." };
  if (!Number.isFinite(weeklyTarget) || weeklyTarget <= 0) {
    return { ok: false, error: "Cible invalide (montant > 0 requis)." };
  }

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return { ok: false, error: "Tontine introuvable." };

  const enrollments = await readCollectionForPeriodId<Enrollment>(periodId, "enrollments");
  const idx = enrollments.findIndex((e) => e.memberId === memberId);
  if (idx < 0) return { ok: false, error: "Inscription introuvable." };

  const next = [...enrollments];
  next[idx] = { ...next[idx], weeklyTarget };
  await writeCollectionForPeriod(period, "enrollments", next);

  const members = await globalMembersRepo.all();
  const member = members.find((m) => m.id === memberId);
  await audit(
    "enrollment.target",
    `${member ? `${member.lastName} ${member.firstName}` : memberId} → ${weeklyTarget}`
  );

  // Pas de revalidate cotisations : la grille met à jour l’état local (évite le jump scroll).
  revalidatePath("/gestion/membres");
  revalidatePath("/membre");
  revalidatePath("/membre/cotisations");
  return { ok: true, weeklyTarget };
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
  | { ok: true; amount: number; locked: boolean; status: "paid" | "unpaid"; penaltyCreated?: boolean }
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
      status: result.status === "unpaid" ? "unpaid" : "paid",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Enregistrement impossible.",
    };
  }
}

/** Marque Payé (cible) ou Impayé (0 + pénalité). Verrouille ensuite. */
export async function markContributionAction(
  formData: FormData
): Promise<SaveContributionResult> {
  const session = await requireRole(["SUPER_ADMIN", "GESTIONNAIRE"]);
  const periodId = String(formData.get("periodId") || "").trim();
  const parsed = markContributionSchema.safeParse({
    memberId: formData.get("memberId"),
    weekId: formData.get("weekId"),
    status: formData.get("status"),
  });
  if (!parsed.success || !periodId) return { ok: false, error: "Données invalides." };

  const weeklyTarget = Number(formData.get("weeklyTarget"));
  if (parsed.data.status === "paid" && !(weeklyTarget > 0)) {
    return { ok: false, error: "Cible de cotisation manquante." };
  }

  if (parsed.data.status === "unpaid") {
    const weeks = await readCollectionForPeriodId<{ id: string; date: string }>(
      periodId,
      "weeks"
    );
    const week = weeks.find((w) => w.id === parsed.data.weekId);
    if (!week) return { ok: false, error: "Séance introuvable." };
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (week.date > todayIso) {
      return { ok: false, error: "Impossible de marquer impayé une séance future." };
    }
  }

  try {
    const settings = await readObjectForPeriodId(periodId, "settings", DEFAULT_SETTINGS);
    const { contribution, penaltyCreated } = await markContributionStatus({
      periodId,
      memberId: parsed.data.memberId,
      weekId: parsed.data.weekId,
      status: parsed.data.status,
      weeklyTarget: weeklyTarget > 0 ? weeklyTarget : 0,
      recordedBy: session.user.id,
      penaltyAmount: settings.penaltyLateContribution,
    });
    if (penaltyCreated) {
      revalidatePath("/gestion/penalites");
      revalidatePath("/membre/penalites");
      revalidatePath("/membre");
    }
    return {
      ok: true,
      amount: contribution.amount,
      locked: contribution.locked !== false,
      status: contribution.status === "unpaid" ? "unpaid" : "paid",
      penaltyCreated,
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

  const settings = await readObjectForPeriodId(periodId, "settings", DEFAULT_SETTINGS);
  const requirePassword = settings.requirePasswordToUnlockContribution !== false;
  if (requirePassword) {
    if (!password) return { error: "Mot de passe requis." };
    const ok = await verifySessionPassword(password);
    if (!ok) return { error: "Mot de passe incorrect." };
  }

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
  const session = await requireLoanInitiator();
  const periodId = String(formData.get("periodId") || "").trim();
  const feeRaw = String(formData.get("withdrawalFee") ?? "").trim();
  const feeParsed =
    feeRaw === "" ? 0 : Number(feeRaw.replace(",", "."));

  const parseWitness = (prefix: string): LoanWitness | null => {
    const memberId = String(formData.get(`${prefix}MemberId`) || "").trim();
    const name = String(formData.get(`${prefix}Name`) || "").trim();
    const phoneRaw = String(formData.get(`${prefix}Phone`) || "").trim();
    const address = String(formData.get(`${prefix}Address`) || "").trim();
    const mode = String(formData.get(`${prefix}Mode`) || "member").trim();
    const cipProvided = formData.get(`${prefix}CipProvided`) === "on";
    if (mode === "member" || memberId) {
      if (!memberId) return null;
      return {
        memberId,
        name: name || memberId,
        phone: phoneRaw || undefined,
        address: address || undefined,
        isGroupMember: true,
      };
    }
    if (!name) return null;
    return {
      name,
      phone: phoneRaw || undefined,
      address: address || undefined,
      isGroupMember: false,
      cipProvided,
    };
  };

  const w1 = parseWitness("witness1");
  const w2 = parseWitness("witness2");
  const witnesses = [w1, w2].filter(Boolean) as LoanWitness[];

  const histDates = formData.getAll("histRepayDate").map((v) => String(v).trim());
  const histAmounts = formData
    .getAll("histRepayAmount")
    .map((v) => Number(String(v).replace(",", ".")));
  const historicalRepayments: { date: string; amount: number }[] = [];
  for (let i = 0; i < Math.max(histDates.length, histAmounts.length); i++) {
    const date = histDates[i] || "";
    const amount = histAmounts[i];
    if (!date && !(Number.isFinite(amount) && amount > 0)) continue;
    if (!date || !Number.isFinite(amount) || amount <= 0) return;
    historicalRepayments.push({ date, amount: Math.round(amount) });
  }
  historicalRepayments.sort((a, b) => a.date.localeCompare(b.date));

  const parsed = loanInputSchema.safeParse({
    memberId: formData.get("memberId"),
    date: formData.get("date"),
    amount: Number(formData.get("amount")),
    withdrawalFee: Number.isFinite(feeParsed) ? Math.max(0, feeParsed) : 0,
    dueDate: formData.get("dueDate"),
    applyInterest: formData.get("applyInterest") === "on",
    alreadySettled: formData.get("alreadySettled") === "on",
    settledAt: String(formData.get("settledAt") || "").trim() || undefined,
    historicalRepayments,
    witnesses,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success || !periodId) return;

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return;

  const settings = await readObjectForPeriodId(periodId, "settings", DEFAULT_SETTINGS);
  const threshold =
    settings.loanSecondWitnessThreshold ??
    DEFAULT_SETTINGS.loanSecondWitnessThreshold;
  const maxMonths = settings.loanMaxDurationMonths || 2;

  const enrolled = await listEnrolledForPeriod(periodId);
  const borrower = enrolled.find((m) => m.id === parsed.data.memberId);
  if (!borrower || borrower.status !== "Actif") return;

  const maxDue = addMonthsIso(parsed.data.date, maxMonths);
  if (parsed.data.dueDate > maxDue) return;

  const needTwo = parsed.data.amount > threshold;
  if (needTwo && parsed.data.witnesses.length < 2) return;
  if (!needTwo && parsed.data.witnesses.length < 1) return;

  const groupCount = parsed.data.witnesses.filter((w) => w.isGroupMember).length;
  if (groupCount < 1) return;
  if (!parsed.data.witnesses[0]?.isGroupMember) return;

  const activeById = new Map(
    enrolled.filter((m) => m.status === "Actif").map((m) => [m.id, m])
  );
  const resolved: LoanWitness[] = [];
  for (const w of parsed.data.witnesses) {
    if (w.isGroupMember) {
      if (!w.memberId || !activeById.has(w.memberId)) return;
      if (w.memberId === parsed.data.memberId) return;
      const m = activeById.get(w.memberId)!;
      resolved.push({
        memberId: m.id,
        name: `${m.lastName} ${m.firstName}`.trim(),
        phone: m.phone,
        address: m.address,
        isGroupMember: true,
      });
    } else {
      if (w.name.length < 2) return;
      resolved.push({
        name: w.name,
        phone: w.phone,
        address: w.address,
        isGroupMember: false,
        cipProvided: Boolean(w.cipProvided),
      });
    }
  }
  // Uniques memberIds
  const ids = resolved.map((w) => w.memberId).filter(Boolean);
  if (new Set(ids).size !== ids.length) return;

  const users = await usersRepo.all();
  let requiredApproverIds = users
    .filter((u) => u.active && isLoanQuorumRole(u.role))
    .map((u) => u.id);
  if (requiredApproverIds.length === 0) {
    requiredApproverIds = users.filter((u) => u.active && u.role === "SUPER_ADMIN").map((u) => u.id);
  }
  if (requiredApproverIds.length === 0) return;

  const contracted = loanContractedMonths(
    parsed.data.date,
    parsed.data.dueDate,
    maxMonths
  );
  const today = todayIsoLocal();
  const applyInterest = parsed.data.applyInterest !== false;
  const alreadySettled = parsed.data.alreadySettled === true;
  const histRepays = alreadySettled
    ? []
    : parsed.data.historicalRepayments ?? [];
  const histTotal = histRepays.reduce((s, r) => s + r.amount, 0);
  const settledAt =
    alreadySettled
      ? parsed.data.settledAt || parsed.data.dueDate || parsed.data.date
      : undefined;

  // Import historique (soldé ou tranches) : pas de rattrapage d’intérêts de retard.
  const isHistoricalImport = alreadySettled || histRepays.length > 0;

  let figures: ReturnType<typeof computeLoanFigures>;
  let interestExtra = 0;
  let lateApplied = 0;

  if (alreadySettled && settledAt) {
    // Intérêts calculés jusqu’à la date de solde (pas jusqu’à l’échéance max).
    const asOf = computeLoanInterestAsOf(parsed.data.amount, settings, {
      loanDate: parsed.data.date,
      dueDate: parsed.data.dueDate,
      asOfDate: settledAt,
      applyInterest,
      withdrawalFeeOverride: parsed.data.withdrawalFee ?? 0,
      maxMonths,
    });
    figures = {
      withdrawalFee: asOf.withdrawalFee,
      interestMonth1: asOf.interestMonth1,
      interestMonth2: asOf.interestMonth2,
      totalDue:
        parsed.data.amount + asOf.interestMonth1 + asOf.interestMonth2,
      contractedMonths: asOf.contractedMonths,
      accruedMonths: asOf.accruedMonths,
    };
    interestExtra = asOf.interestExtra;
    lateApplied = asOf.lateMonths;
  } else {
    figures = computeLoanFigures(parsed.data.amount, settings, {
      withdrawalFeeOverride: parsed.data.withdrawalFee ?? 0,
      contractedMonths: contracted,
      accruedMonths: loanAccruedNormalMonths(
        parsed.data.date,
        today,
        contracted
      ),
      applyInterest,
    });

    const rawLate =
      settings.interestRateExtra ?? DEFAULT_SETTINGS.interestRateExtra;
    const lateRate = Math.abs(rawLate - 0.015) < 1e-9 ? 0.15 : rawLate;
    if (
      !isHistoricalImport &&
      applyInterest &&
      parsed.data.dueDate &&
      today > parsed.data.dueDate
    ) {
      const monthsLate = completeLateMonths(parsed.data.dueDate, today);
      for (let i = 0; i < monthsLate; i++) {
        interestExtra += Math.round(parsed.data.amount * lateRate);
        lateApplied += 1;
      }
    } else if (
      isHistoricalImport &&
      !alreadySettled &&
      applyInterest &&
      parsed.data.dueDate &&
      today > parsed.data.dueDate
    ) {
      lateApplied = completeLateMonths(parsed.data.dueDate, today);
    }
  }

  const totalDue =
    parsed.data.amount +
    figures.interestMonth1 +
    figures.interestMonth2 +
    interestExtra;

  if (histTotal >= totalDue && histTotal > 0) return;
  if (histRepays.some((r) => r.date < parsed.data.date)) return;

  const year = settings.year;
  const existing = await readCollectionForPeriodId<Loan>(periodId, "loans");
  const loanId = nextSequentialId(
    existing.map((l) => l.id),
    `PRE-${year}-`
  );

  const first = resolved[0];
  const loan: Loan = {
    id: loanId,
    memberId: parsed.data.memberId,
    date: parsed.data.date,
    amount: parsed.data.amount,
    withdrawalFee: figures.withdrawalFee,
    witnessName: first.name,
    witnessPhone: first.phone,
    witnessAddress: first.address,
    witnesses: resolved,
    docsChecklist: { letterSigned: false, cipVerified: false },
    lateInterestAppliedMonths: lateApplied,
    dueDate: parsed.data.dueDate,
    applyInterest,
    alreadySettled: alreadySettled || undefined,
    settledAt,
    pendingHistoricalRepayments:
      histRepays.length > 0 ? histRepays : undefined,
    interestMonth1: figures.interestMonth1,
    interestMonth2: figures.interestMonth2,
    interestExtra,
    totalDue,
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
  const letterSigned = formData.get("letterSigned") === "on";
  const cipVerified = formData.get("cipVerified") === "on";
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

  const witnesses =
    loan.witnesses && loan.witnesses.length > 0
      ? loan.witnesses
      : loan.witnessName
        ? [{ name: loan.witnessName, isGroupMember: false as const }]
        : [];
  const needsCip = witnesses.some((w) => !w.isGroupMember);

  if (decision === "approved") {
    if (!letterSigned) return;
    if (needsCip && !cipVerified) return;
  }

  approvals.push({
    userId: session.user.id,
    userName: session.user.name,
    decision,
    at: new Date().toISOString(),
    note:
      decision === "approved" && session.user.role === "SUPER_ADMIN"
        ? note || "Approbation super admin — quorum complet"
        : note,
  });

  const docsChecklist = {
    letterSigned:
      decision === "approved"
        ? true
        : Boolean(loan.docsChecklist?.letterSigned),
    cipVerified:
      decision === "approved"
        ? needsCip
          ? true
          : Boolean(loan.docsChecklist?.cipVerified)
        : Boolean(loan.docsChecklist?.cipVerified),
  };

  let next: Loan = { ...loan, approvals, docsChecklist };

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
  // Super admin : un seul avis d’accord suffit pour tout le quorum.
  const allApproved =
    session.user.role === "SUPER_ADMIN" ||
    required.every((id) => approvedIds.has(id));

  if (allApproved) {
    const now = new Date().toISOString();
    const settled = Boolean(loan.alreadySettled);
    const settleDate = loan.settledAt || loan.dueDate || loan.date;
    const hist = [...(loan.pendingHistoricalRepayments ?? [])].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const todayIso = todayIsoLocal();

    let repaidRunning = 0;
    let interestPaidRunning = 0;
    const interestsTotal =
      loan.interestMonth1 + loan.interestMonth2 + loan.interestExtra;
    const newRepaymentRows: Repayment[] = [];

    if (settled) {
      const repaidAmount = loan.totalDue;
      repaidRunning = repaidAmount;
      interestPaidRunning = Math.min(repaidAmount, interestsTotal);
      const capitalPaid = repaidAmount - interestPaidRunning;
      if (repaidAmount > 0) {
        newRepaymentRows.push({
          id: newId("REM"),
          loanId: loan.id,
          date: settleDate,
          amount: repaidAmount,
          capital: capitalPaid,
          interest: interestPaidRunning,
          remainingBalance: 0,
          recordedBy: session.user.id,
          createdAt: now,
        });
      }
    } else if (hist.length > 0) {
      for (const row of hist) {
        const remaining = Math.max(0, loan.totalDue - repaidRunning);
        if (remaining <= 0) break;
        const amount = Math.min(row.amount, remaining);
        if (amount <= 0) continue;
        const interestLeft = Math.max(0, interestsTotal - interestPaidRunning);
        const interest = Math.min(amount, interestLeft);
        const capital = amount - interest;
        repaidRunning += amount;
        interestPaidRunning += interest;
        const rem = Math.max(0, loan.totalDue - repaidRunning);
        newRepaymentRows.push({
          id: newId("REM"),
          loanId: loan.id,
          date: row.date,
          amount,
          capital,
          interest,
          remainingBalance: rem,
          recordedBy: session.user.id,
          createdAt: now,
        });
      }
    }

    const remAfter = Math.max(0, loan.totalDue - repaidRunning);
    const status: Loan["status"] = settled
      ? "Remboursé"
      : remAfter <= 0
        ? "Remboursé"
        : loan.dueDate && todayIso > loan.dueDate
          ? "En retard"
          : "En cours";

    next = {
      ...next,
      status,
      disbursedAt: now,
      repaid: repaidRunning,
      pendingHistoricalRepayments: undefined,
    };
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

    if (newRepaymentRows.length > 0) {
      const repayments = await readCollectionForPeriodId<Repayment>(
        periodId,
        "repayments"
      );
      await writeCollectionForPeriod(period, "repayments", [
        ...repayments,
        ...newRepaymentRows,
      ]);
      for (const row of newRepaymentRows) {
        await appendCashEntry({
          date: row.date,
          type: "Entrée",
          description: settled
            ? `Remboursement ${loan.id} (solde historique)`
            : `Remboursement ${loan.id} (tranche historique)`,
          amount: row.amount,
          reference: row.id,
          origin: "Remboursement",
          recordedBy: session.user.name,
          periodId,
        });
      }
    }

    const auditKey =
      session.user.role === "SUPER_ADMIN"
        ? settled
          ? "loan.disburse.settled.superadmin"
          : hist.length > 0
            ? "loan.disburse.partial.superadmin"
            : "loan.disburse.superadmin"
        : settled
          ? "loan.disburse.settled"
          : hist.length > 0
            ? "loan.disburse.partial"
            : "loan.disburse";
    await audit(auditKey, loanId);
    revalidatePath("/gestion/prets");
    revalidatePath("/gestion/remboursements");
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

export async function deleteLoanAction(formData: FormData) {
  await requireGestionWrite();
  const periodId = String(formData.get("periodId") || "").trim();
  const loanId = String(formData.get("loanId") || "").trim();
  if (!periodId || !loanId) return;

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return;

  const [loans, repayments] = await Promise.all([
    readCollectionForPeriodId<Loan>(periodId, "loans"),
    readCollectionForPeriodId<Repayment>(periodId, "repayments"),
  ]);
  const loan = loans.find((l) => l.id === loanId);
  if (!loan) return;
  if (loan.repaid > 0 || repayments.some((r) => r.loanId === loanId)) return;

  await writeCollectionForPeriod(
    period,
    "loans",
    loans.filter((l) => l.id !== loanId)
  );

  const hasCashImpact =
    Boolean(loan.disbursedAt) ||
    loan.status === "En cours" ||
    loan.status === "En retard";
  if (hasCashImpact) {
    await removeCashEntriesByReference({
      periodId,
      reference: loanId,
      origin: CASH_ORIGIN_LOAN,
    });
  }

  await audit("loan.delete", loanId);
  revalidatePath("/gestion/prets");
  revalidatePath("/gestion/caisse");
  revalidatePath("/gestion");
  return;
}

export type UpdateLoanState = { error?: string; ok?: boolean } | null;

export async function updateLoanAction(
  _prev: UpdateLoanState,
  formData: FormData
): Promise<UpdateLoanState> {
  const session = await requireGestionWrite();
  const periodId = String(formData.get("periodId") || "").trim();
  if (!periodId) return { error: "Tontine manquante." };

  const parseWitness = (prefix: string): LoanWitness | null => {
    const memberId = String(formData.get(`${prefix}MemberId`) || "").trim();
    const name = String(formData.get(`${prefix}Name`) || "").trim();
    const phoneRaw = String(formData.get(`${prefix}Phone`) || "").trim();
    const address = String(formData.get(`${prefix}Address`) || "").trim();
    const mode = String(formData.get(`${prefix}Mode`) || "member").trim();
    const cipProvided = formData.get(`${prefix}CipProvided`) === "on";
    if (mode === "member" || memberId) {
      if (!memberId) return null;
      return {
        memberId,
        name: name || memberId,
        phone: phoneRaw || undefined,
        address: address || undefined,
        isGroupMember: true,
      };
    }
    if (!name) return null;
    return {
      name,
      phone: phoneRaw || undefined,
      address: address || undefined,
      isGroupMember: false,
      cipProvided,
    };
  };

  const w1 = parseWitness("witness1");
  const w2 = parseWitness("witness2");
  const witnesses = [w1, w2].filter(Boolean) as LoanWitness[];

  const repayDates = formData.getAll("repayDate").map((v) => String(v).trim());
  const repayAmounts = formData
    .getAll("repayAmount")
    .map((v) => Number(String(v).replace(",", ".")));
  const repayIds = formData.getAll("repayId").map((v) => String(v).trim());
  const repaymentsIn: { id?: string; date: string; amount: number }[] = [];
  for (let i = 0; i < Math.max(repayDates.length, repayAmounts.length); i++) {
    const date = repayDates[i] || "";
    const amount = repayAmounts[i];
    const id = repayIds[i] || undefined;
    if (!date && !(Number.isFinite(amount) && amount > 0)) continue;
    if (!date || !Number.isFinite(amount) || amount <= 0) {
      return { error: "Chaque tranche doit avoir une date et un montant valide." };
    }
    repaymentsIn.push({
      id: id || undefined,
      date,
      amount: Math.round(amount),
    });
  }

  const feeRaw = Number(String(formData.get("withdrawalFee") || "0").replace(",", "."));
  const interestExtraRaw = Number(
    String(formData.get("interestExtra") || "0").replace(",", ".")
  );

  const parsed = updateLoanSchema.safeParse({
    loanId: formData.get("loanId"),
    date: formData.get("date"),
    amount: Number(formData.get("amount")),
    withdrawalFee: Number.isFinite(feeRaw) ? Math.max(0, Math.round(feeRaw)) : 0,
    dueDate: formData.get("dueDate"),
    applyInterest: formData.get("applyInterest") === "on",
    interestExtra: Number.isFinite(interestExtraRaw)
      ? Math.max(0, Math.round(interestExtraRaw))
      : 0,
    markSettled: formData.get("markSettled") === "on",
    settledAt: String(formData.get("settledAt") || "").trim() || undefined,
    notes: String(formData.get("notes") || "").trim() || undefined,
    repayments: repaymentsIn,
    witnesses,
  });
  if (!parsed.success) {
    return { error: "Données invalides. Vérifiez les champs." };
  }

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return { error: "Tontine introuvable." };

  const [loans, allRepayments, settings, enrolled] = await Promise.all([
    readCollectionForPeriodId<Loan>(periodId, "loans"),
    readCollectionForPeriodId<Repayment>(periodId, "repayments"),
    readObjectForPeriodId(periodId, "settings", DEFAULT_SETTINGS),
    listEnrolledForPeriod(periodId),
  ]);

  const idx = loans.findIndex((l) => l.id === parsed.data.loanId);
  if (idx < 0) return { error: "Prêt introuvable." };
  const loan = loans[idx];
  if (loan.status === "Refusé") {
    return { error: "Un prêt refusé ne peut pas être modifié." };
  }

  const maxMonths = settings.loanMaxDurationMonths || 2;
  const maxDue = addMonthsIso(parsed.data.date, maxMonths);
  if (parsed.data.dueDate > maxDue) {
    return {
      error: `Échéance max : ${maxDue} (${maxMonths} mois après la date du prêt).`,
    };
  }
  if (parsed.data.dueDate < parsed.data.date) {
    return { error: "L’échéance doit être postérieure à la date du prêt." };
  }

  const threshold =
    settings.loanSecondWitnessThreshold ??
    DEFAULT_SETTINGS.loanSecondWitnessThreshold;
  const needTwo = parsed.data.amount > threshold;
  if (needTwo && parsed.data.witnesses.length < 2) {
    return { error: "2 cautions requises au-delà du seuil." };
  }
  if (!needTwo && parsed.data.witnesses.length < 1) {
    return { error: "Au moins une caution est requise." };
  }
  const groupCount = parsed.data.witnesses.filter((w) => w.isGroupMember).length;
  if (groupCount < 1 || !parsed.data.witnesses[0]?.isGroupMember) {
    return { error: "La 1ʳᵉ caution doit être un membre de la tontine." };
  }

  const activeById = new Map(
    enrolled.filter((m) => m.status === "Actif").map((m) => [m.id, m])
  );
  const resolved: LoanWitness[] = [];
  for (const w of parsed.data.witnesses) {
    if (w.isGroupMember) {
      if (!w.memberId || !activeById.has(w.memberId)) {
        return { error: "Caution membre invalide ou inactive." };
      }
      if (w.memberId === loan.memberId) {
        return { error: "L’emprunteur ne peut pas être sa propre caution." };
      }
      const m = activeById.get(w.memberId)!;
      resolved.push({
        memberId: m.id,
        name: `${m.lastName} ${m.firstName}`.trim(),
        phone: m.phone,
        address: m.address,
        isGroupMember: true,
      });
    } else {
      if (w.name.length < 2) return { error: "Nom de caution externe requis." };
      resolved.push({
        name: w.name,
        phone: w.phone,
        address: w.address,
        isGroupMember: false,
        cipProvided: Boolean(w.cipProvided),
      });
    }
  }
  const ids = resolved.map((w) => w.memberId).filter(Boolean);
  if (new Set(ids).size !== ids.length) {
    return { error: "Cautions membres en double." };
  }

  const today = todayIsoLocal();
  const applyInterest = parsed.data.applyInterest;
  const contracted = loanContractedMonths(
    parsed.data.date,
    parsed.data.dueDate,
    maxMonths
  );
  const isPending = loan.status === "En attente";
  const startDate = isPending
    ? parsed.data.date
    : loan.disbursedAt?.slice(0, 10) || parsed.data.date;

  const markSettled = parsed.data.markSettled;
  const settleDate =
    parsed.data.settledAt || parsed.data.dueDate || parsed.data.date || today;

  let figures: ReturnType<typeof computeLoanFigures>;
  let interestExtra: number;
  let lateApplied: number;

  if (markSettled) {
    const asOf = computeLoanInterestAsOf(parsed.data.amount, settings, {
      loanDate: parsed.data.date,
      dueDate: parsed.data.dueDate,
      asOfDate: settleDate,
      applyInterest,
      withdrawalFeeOverride: parsed.data.withdrawalFee,
      maxMonths,
    });
    figures = {
      withdrawalFee: asOf.withdrawalFee,
      interestMonth1: asOf.interestMonth1,
      interestMonth2: asOf.interestMonth2,
      totalDue:
        parsed.data.amount + asOf.interestMonth1 + asOf.interestMonth2,
      contractedMonths: asOf.contractedMonths,
      accruedMonths: asOf.accruedMonths,
    };
    interestExtra = asOf.interestExtra;
    lateApplied = asOf.lateMonths;
  } else {
    figures = computeLoanFigures(parsed.data.amount, settings, {
      withdrawalFeeOverride: parsed.data.withdrawalFee,
      contractedMonths: contracted,
      accruedMonths: applyInterest
        ? loanAccruedNormalMonths(startDate, today, contracted)
        : 0,
      applyInterest,
    });
    interestExtra = applyInterest ? parsed.data.interestExtra : 0;
    lateApplied =
      applyInterest && parsed.data.dueDate && today > parsed.data.dueDate
        ? completeLateMonths(parsed.data.dueDate, today)
        : 0;
  }

  const totalDue =
    parsed.data.amount +
    figures.interestMonth1 +
    figures.interestMonth2 +
    interestExtra;

  let repayRows = [...parsed.data.repayments].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  if (repayRows.some((r) => r.date < parsed.data.date)) {
    return { error: "Une tranche ne peut pas être antérieure à la date du prêt." };
  }

  let repaidSum = repayRows.reduce((s, r) => s + r.amount, 0);
  if (markSettled && repaidSum < totalDue) {
    const gap = totalDue - repaidSum;
    repayRows = [
      ...repayRows,
      { date: settleDate, amount: gap },
    ].sort((a, b) => a.date.localeCompare(b.date));
    repaidSum = totalDue;
  }
  if (repaidSum > totalDue) {
    return {
      error: `Le total des tranches (${repaidSum}) dépasse le dû (${totalDue}).`,
    };
  }

  // Prêt encore en attente : les tranches restent en pending jusqu’à décaissement.
  if (isPending) {
    const first = resolved[0];
    const nextLoan: Loan = {
      ...loan,
      date: parsed.data.date,
      amount: parsed.data.amount,
      withdrawalFee: figures.withdrawalFee,
      dueDate: parsed.data.dueDate,
      applyInterest,
      alreadySettled: markSettled || undefined,
      settledAt: markSettled ? settleDate : undefined,
      pendingHistoricalRepayments:
        !markSettled && repayRows.length > 0
          ? repayRows.map((r) => ({ date: r.date, amount: r.amount }))
          : undefined,
      interestMonth1: figures.interestMonth1,
      interestMonth2: figures.interestMonth2,
      interestExtra,
      lateInterestAppliedMonths: lateApplied,
      totalDue,
      repaid: 0,
      witnessName: first.name,
      witnessPhone: first.phone,
      witnessAddress: first.address,
      witnesses: resolved,
      notes: parsed.data.notes,
    };
    const copy = [...loans];
    copy[idx] = nextLoan;
    await writeCollectionForPeriod(period, "loans", copy);
    await audit("loan.update", loan.id);
    revalidatePath("/gestion/prets");
    revalidatePath("/gestion");
    return { ok: true };
  }

  // Décaissé : synchroniser remboursements + caisse
  const oldRepays = allRepayments.filter((r) => r.loanId === loan.id);
  for (const old of oldRepays) {
    await removeCashEntriesByReference({
      periodId,
      reference: old.id,
      origin: CASH_ORIGIN_REPAYMENT,
    });
  }

  const interestsTotal =
    figures.interestMonth1 + figures.interestMonth2 + interestExtra;
  let repaidRunning = 0;
  let interestPaidRunning = 0;
  const now = new Date().toISOString();
  const newRepayments: Repayment[] = [];
  for (const row of repayRows) {
    const remaining = Math.max(0, totalDue - repaidRunning);
    if (remaining <= 0) break;
    const amount = Math.min(row.amount, remaining);
    if (amount <= 0) continue;
    const interestLeft = Math.max(0, interestsTotal - interestPaidRunning);
    const interest = Math.min(amount, interestLeft);
    const capital = amount - interest;
    repaidRunning += amount;
    interestPaidRunning += interest;
    const rem = Math.max(0, totalDue - repaidRunning);
    newRepayments.push({
      id: row.id && row.id.startsWith("REM") ? row.id : newId("REM"),
      loanId: loan.id,
      date: row.date,
      amount,
      capital,
      interest,
      remainingBalance: rem,
      recordedBy: session.user.id,
      createdAt: now,
    });
  }

  const remAfter = Math.max(0, totalDue - repaidRunning);
  const status: Loan["status"] =
    remAfter <= 0 || markSettled
      ? "Remboursé"
      : parsed.data.dueDate && today > parsed.data.dueDate
        ? "En retard"
        : "En cours";

  const first = resolved[0];
  const nextLoan: Loan = {
    ...loan,
    date: parsed.data.date,
    amount: parsed.data.amount,
    withdrawalFee: figures.withdrawalFee,
    dueDate: parsed.data.dueDate,
    applyInterest,
    alreadySettled: status === "Remboursé" && markSettled ? true : loan.alreadySettled,
    settledAt:
      status === "Remboursé"
        ? settleDate
        : undefined,
    pendingHistoricalRepayments: undefined,
    interestMonth1: figures.interestMonth1,
    interestMonth2: figures.interestMonth2,
    interestExtra,
    lateInterestAppliedMonths: lateApplied,
    totalDue,
    repaid: repaidRunning,
    status,
    witnessName: first.name,
    witnessPhone: first.phone,
    witnessAddress: first.address,
    witnesses: resolved,
    notes: parsed.data.notes,
  };

  const copy = [...loans];
  copy[idx] = nextLoan;
  await writeCollectionForPeriod(period, "loans", copy);

  const otherRepays = allRepayments.filter((r) => r.loanId !== loan.id);
  await writeCollectionForPeriod(period, "repayments", [
    ...otherRepays,
    ...newRepayments,
  ]);

  // Sortie caisse prêt
  await removeCashEntriesByReference({
    periodId,
    reference: loan.id,
    origin: CASH_ORIGIN_LOAN,
  });
  await appendCashEntry({
    date: parsed.data.date,
    type: "Sortie",
    description: `Prêt ${loan.id}`,
    amount: parsed.data.amount + figures.withdrawalFee,
    reference: loan.id,
    origin: CASH_ORIGIN_LOAN,
    recordedBy: session.user.name,
    periodId,
  });

  for (const row of newRepayments) {
    await appendCashEntry({
      date: row.date,
      type: "Entrée",
      description: `Remboursement ${loan.id}`,
      amount: row.amount,
      reference: row.id,
      origin: CASH_ORIGIN_REPAYMENT,
      recordedBy: session.user.name,
      periodId,
    });
  }

  await audit("loan.update", loan.id);
  revalidatePath("/gestion/prets");
  revalidatePath("/gestion/remboursements");
  revalidatePath("/gestion/caisse");
  revalidatePath("/gestion");
  return { ok: true };
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

  await reconcileLateLoanInterest(periodId);

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
  const today = parsed.data.date;
  const stillLate = rem > 0 && loan.dueDate && today > loan.dueDate;

  const repayments = await readCollectionForPeriodId<Repayment>(periodId, "repayments");
  const repaymentId = newId("REM");
  await writeCollectionForPeriod(period, "repayments", [
    ...repayments,
    {
      id: repaymentId,
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
            status:
              rem <= 0
                ? ("Remboursé" as const)
                : stillLate
                  ? ("En retard" as const)
                  : ("En cours" as const),
          }
        : l
    )
  );

  await appendCashEntry({
    date: parsed.data.date,
    type: "Entrée",
    description: `Remboursement ${loan.id}`,
    amount,
    reference: repaymentId,
    origin: "Remboursement",
    recordedBy: session.user.name,
    periodId,
  });

  await audit("repayment.create", `${loan.id}: ${amount} (reste ${rem})`);
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
      origin: CASH_ORIGIN_PENALTY,
      recordedBy: session.user.name,
      periodId,
    });
  }

  revalidatePath("/gestion/penalites");
  revalidatePath("/gestion/caisse");
  revalidatePath("/gestion");
  return;
}

export async function deletePenaltyAction(formData: FormData) {
  await requireGestionWrite();
  const id = String(formData.get("id") || "").trim();
  const periodId = String(formData.get("periodId") || "").trim();
  if (!id || !periodId) return;

  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) return;

  const penalties = await readCollectionForPeriodId<Penalty>(periodId, "penalties");
  const target = penalties.find((p) => p.id === id);
  if (!target) return;

  await writeCollectionForPeriod(
    period,
    "penalties",
    penalties.filter((p) => p.id !== id)
  );

  // Si la pénalité avait été marquée payée, retirer l’écriture caisse associée
  await removeCashEntriesByReference({
    periodId,
    reference: id,
    origin: CASH_ORIGIN_PENALTY,
  });

  await audit("penalty.delete", `${target.memberId} · ${target.motifLabel}`);
  revalidatePath("/gestion/penalites");
  revalidatePath("/gestion/caisse");
  revalidatePath("/gestion");
  revalidatePath("/membre");
  revalidatePath("/membre/penalites");
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
