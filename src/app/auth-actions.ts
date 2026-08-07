"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { auditRepo, usersRepo } from "@/lib/db/collections";
import { newId } from "@/lib/db/domain";
import { DEFAULT_TEMP_PASSWORD } from "@/lib/auth/constants";

export type AuthFlowState = { error?: string; ok?: boolean } | null;

async function auditAuth(action: string, details?: string) {
  try {
    const session = await requireSession().catch(() => null);
    await auditRepo.update((items) => [
      ...items,
      {
        id: newId("AUD"),
        at: new Date().toISOString(),
        actorId: session?.user.id ?? "system",
        actorName: session?.user.name ?? "system",
        action,
        details,
      },
    ]);
  } catch {
    /* ignore */
  }
}

/**
 * Première connexion : nouveau mot de passe (+ email optionnel).
 * Pas d’OTP email pour l’instant (en attendant un domaine / Resend).
 */
export async function completePasswordSetupAction(
  _prev: AuthFlowState,
  formData: FormData
): Promise<AuthFlowState> {
  const session = await requireSession();
  const password = String(formData.get("password") || "");
  const passwordConfirm = String(formData.get("passwordConfirm") || "");
  const emailRaw = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  if (password.length < 6) return { error: "Mot de passe : 6 caractères minimum." };
  if (password !== passwordConfirm) return { error: "Les mots de passe ne correspondent pas." };
  if (password === DEFAULT_TEMP_PASSWORD) {
    return { error: "Choisissez un mot de passe différent du temporaire." };
  }
  if (emailRaw && !emailRaw.includes("@")) return { error: "Email invalide." };

  const hash = await bcrypt.hash(password, 10);
  await usersRepo.update((items) =>
    items.map((u) =>
      u.id === session.user.id
        ? {
            ...u,
            ...(emailRaw ? { email: emailRaw } : {}),
            passwordHash: hash,
            mustChangePassword: false,
            updatedAt: new Date().toISOString(),
          }
        : u
    )
  );

  await auditAuth("user.password_setup", session.user.id);
  revalidatePath("/auth/setup-password");
  revalidatePath("/admin/profil");
  revalidatePath("/gestion/profil");
  return { ok: true };
}
