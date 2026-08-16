import { z } from "zod";
import { isValidBeninPhone, beninPhoneSchemaMessage, normalizePhone } from "@/lib/phone";

export const roleSchema = z.enum([
  "SUPER_ADMIN",
  "GESTIONNAIRE",
  "GESTIONNAIRE_LECTURE",
  "MEMBRE",
]);

const beninPhoneRequired = z
  .string()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: beninPhoneSchemaMessage });
      return z.NEVER;
    }
    return n;
  });

const beninPhoneOptional = z
  .union([z.string(), z.literal(""), z.undefined()])
  .transform((v) => {
    if (!v) return undefined;
    return normalizePhone(v) ?? undefined;
  })
  .refine((v) => v === undefined || isValidBeninPhone(v), {
    message: beninPhoneSchemaMessage,
  });

/** Téléphone dépôt : vide autorisé, sinon +229 valide. */
const depositPhoneField = z
  .union([z.string(), z.literal(""), z.undefined(), z.null()])
  .transform((v) => String(v ?? "").trim())
  .superRefine((raw, ctx) => {
    if (!raw) return;
    if (!normalizePhone(raw)) {
      ctx.addIssue({ code: "custom", message: beninPhoneSchemaMessage });
    }
  })
  .transform((raw) => (raw ? normalizePhone(raw)! : ""));

export const settingsSchema = z.object({
  interestRateMonthly: z.number().min(0),
  interestRateExtra: z.number().min(0),
  contributionMin: z.number().min(0),
  contributionStandard: z.number().min(0),
  penaltyLateContribution: z.number().min(0),
  penaltyAbsence: z.number().min(0),
  loanWithdrawalFeeRate: z.number().min(0),
  loanMaxDurationMonths: z.number().min(1),
  loanSecondWitnessThreshold: z.number().min(0),
  maxMembers: z.number().min(1),
  year: z.number().int(),
  cashOpeningBalance: z.number(),
  organizationName: z.string().min(1),
  requirePasswordToUnlockContribution: z.boolean(),
  depositPhone1: depositPhoneField,
  depositName1: z.string().trim(),
  depositPhone2: depositPhoneField,
  depositName2: z.string().trim(),
});

export const createUserSchema = z.object({
  phone: beninPhoneRequired,
  /** Optionnel : un MDP temporaire est attribué automatiquement. */
  password: z.string().min(6).optional(),
  name: z.string().min(2),
  role: roleSchema,
  memberId: z.string().optional().nullable(),
  active: z.boolean().default(true),
  email: z.string().email().optional().or(z.literal("")),
});

export const updateUserSchema = z.object({
  id: z.string(),
  phone: beninPhoneRequired.optional(),
  password: z.string().min(6).optional(),
  name: z.string().min(2).optional(),
  role: roleSchema.optional(),
  memberId: z.string().optional().nullable(),
  active: z.boolean().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export const memberSchema = z.object({
  id: z.string().optional(),
  lastName: z.string().min(1),
  firstName: z.string().min(1),
  phone: beninPhoneOptional,
  email: z.string().email().optional().or(z.literal("")),
  sex: z.enum(["M", "F", ""]).optional(),
  cip: z.string().optional(),
  birthDate: z.string().optional(),
  joinedAt: z.string().optional(),
  address: z.string().optional(),
  profession: z.string().optional(),
  sponsor: z.string().optional(),
  notes: z.string().optional(),
  origin: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export const enrollmentFieldsSchema = z.object({
  status: z.enum(["Actif", "Inactif", "Suspendu"]).default("Actif"),
  weeklyTarget: z.number().min(0).default(500),
});

export const periodicitySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("weekday"),
    weekday: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
  }),
  z.object({
    type: z.literal("every_n_days"),
    intervalDays: z.number().int().min(1),
  }),
]);

export const createPeriodSchema = z
  .object({
    name: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    periodicity: periodicitySchema,
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "La date de fin doit être postérieure ou égale à la date de début",
    path: ["endDate"],
  });

export const contributionInputSchema = z.object({
  memberId: z.string(),
  weekId: z.string(),
  amount: z.number().min(0),
});

export const markContributionSchema = z.object({
  memberId: z.string().min(1),
  weekId: z.string().min(1),
  status: z.enum(["paid", "unpaid"]),
});

export const loanWitnessSchema = z.object({
  memberId: z.string().optional(),
  name: z.string().min(2, "Nom de la caution requis"),
  phone: beninPhoneOptional,
  address: z.string().optional(),
  isGroupMember: z.boolean(),
  cipProvided: z.boolean().optional(),
});

export const loanInputSchema = z.object({
  memberId: z.string().min(1),
  date: z.string().min(1),
  amount: z.number().positive(),
  /** Frais de retrait en FCFA (optionnel ; défaut = taux paramètres). */
  withdrawalFee: z.number().min(0).optional(),
  dueDate: z.string().min(1),
  /** Intérêts contrat + retard. Défaut true. */
  applyInterest: z.boolean().default(true),
  /** Déjà soldé (import historique). */
  alreadySettled: z.boolean().default(false),
  settledAt: z.string().optional(),
  /** Tranches déjà payées (prêt encore ouvert). */
  historicalRepayments: z
    .array(
      z.object({
        date: z.string().min(1),
        amount: z.number().positive(),
      })
    )
    .default([]),
  witnesses: z.array(loanWitnessSchema).min(1, "Au moins une caution"),
  notes: z.string().optional(),
});

/** Édition d’un prêt existant (emprunteur inchangé). */
export const updateLoanSchema = z.object({
  loanId: z.string().min(1),
  date: z.string().min(1),
  amount: z.number().positive(),
  withdrawalFee: z.number().min(0),
  dueDate: z.string().min(1),
  applyInterest: z.boolean(),
  interestExtra: z.number().min(0),
  markSettled: z.boolean().default(false),
  settledAt: z.string().optional(),
  notes: z.string().optional(),
  repayments: z
    .array(
      z.object({
        id: z.string().optional(),
        date: z.string().min(1),
        amount: z.number().positive(),
      })
    )
    .default([]),
  witnesses: z.array(loanWitnessSchema).min(1, "Au moins une caution"),
});

export const repaymentInputSchema = z.object({
  loanId: z.string(),
  date: z.string(),
  amount: z.number().positive(),
});

export const penaltyInputSchema = z.object({
  memberId: z.string(),
  date: z.string(),
  motif: z.enum(["retard_cotisation", "absence_reunion", "autre"]),
  motifLabel: z.string().min(1),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

export const cashInputSchema = z.object({
  date: z.string(),
  type: z.enum(["Entrée", "Sortie"]),
  description: z.string().min(1),
  amount: z.number().positive(),
  reference: z.string().optional(),
  origin: z.string().optional(),
});

export const weekInputSchema = z.object({
  date: z.string(),
  label: z.string().optional(),
});
