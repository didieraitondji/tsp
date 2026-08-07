"use client";

import { useActionState, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { KeyRound } from "lucide-react";
import { completePasswordSetupAction, type AuthFlowState } from "@/app/auth-actions";
import { PasswordInput } from "@/components/password-input";
import { Input, Label } from "@/components/ui";

export function SetupPasswordForm({
  initialEmail,
}: {
  initialEmail?: string | null;
}) {
  const { update } = useSession();
  const [email, setEmail] = useState(initialEmail || "");

  const [state, formAction, pending] = useActionState<AuthFlowState, FormData>(
    completePasswordSetupAction,
    null
  );

  useEffect(() => {
    if (!state?.ok) return;
    (async () => {
      await update({
        mustChangePassword: false,
        ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
      });
      // Remplace setup-password dans l’historique.
      window.location.replace("/login/redirect");
    })();
  }, [state?.ok, email, update]);

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
          Première connexion
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--navy)]">
          Choisissez votre mot de passe
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Remplacez le mot de passe temporaire pour sécuriser votre compte.
        </p>
      </div>

      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-5"
      >
        <div className="flex items-center gap-2 text-[var(--navy)]">
          <KeyRound className="h-4 w-4 text-[var(--sand)]" />
          <p className="text-sm font-semibold">Nouveau mot de passe</p>
        </div>

        <div>
          <Label>Email (optionnel)</Label>
          <Input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
          />
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Optionnel — pourra servir plus tard (notifications, sécurité).
          </p>
        </div>

        <div>
          <Label>Nouveau mot de passe</Label>
          <PasswordInput name="password" required minLength={6} autoComplete="new-password" />
        </div>
        <div>
          <Label>Confirmer</Label>
          <PasswordInput
            name="passwordConfirm"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full cursor-pointer rounded-full bg-[#1D2D50] px-4 py-2.5 text-sm font-semibold text-[#FFCD79] disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer et continuer"}
        </button>
      </form>
    </div>
  );
}
