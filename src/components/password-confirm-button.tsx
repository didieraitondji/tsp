"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { PasswordInput } from "@/components/password-input";

export type PasswordConfirmState = { error?: string } | null;

type PasswordConfirmAction = (
  prev: PasswordConfirmState,
  formData: FormData
) => Promise<PasswordConfirmState>;

export function PasswordConfirmButton({
  action,
  periodId,
  title,
  description,
  confirmLabel,
  pendingLabel,
  triggerLabel,
  triggerClassName,
  tone = "default",
}: {
  action: PasswordConfirmAction;
  periodId: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  triggerLabel: ReactNode;
  triggerClassName: string;
  tone?: "default" | "danger";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  const confirmClass =
    tone === "danger"
      ? "cursor-pointer rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
      : "cursor-pointer rounded-full bg-[#1D2D50] px-4 py-2 text-sm font-semibold text-[#FFCD79] transition hover:bg-[#152238] disabled:cursor-wait disabled:opacity-60";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[min(calc(100%-2rem),24rem)] max-h-[min(90vh,40rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-0 shadow-[0_24px_60px_-20px_rgba(21,34,56,0.45)] backdrop:bg-black/45"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        <form action={formAction} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                tone === "danger" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
              }`}
            >
              <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="cursor-pointer rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--cream)] disabled:opacity-60"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h3 className="mt-3 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
            {title}
          </h3>
          <div className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{description}</div>

          <input type="hidden" name="periodId" value={periodId} />

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Confirmez avec votre mot de passe
            </label>
            <PasswordInput
              name="password"
              required
              autoComplete="current-password"
              placeholder="Mot de passe"
            />
          </div>

          {state?.error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {state.error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)] disabled:opacity-60"
            >
              Annuler
            </button>
            <button type="submit" disabled={pending} className={confirmClass}>
              {pending ? pendingLabel : confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
