"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deletePeriodAction, type DeletePeriodState } from "@/app/actions";
import { PasswordInput } from "@/components/password-input";

export function DeletePeriodButton({
  periodId,
  periodName,
}: {
  periodId: string;
  periodName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<DeletePeriodState, FormData>(
    deletePeriodAction,
    null
  );
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        Supprimer
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700">
              <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--cream)]"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h3 className="mt-3 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
            Supprimer la tontine
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Vous allez supprimer définitivement{" "}
            <strong className="text-[var(--navy)]">{periodName}</strong> et toutes ses
            données (inscriptions, cotisations, prêts…). L’annuaire global des membres est
            conservé. Cette action est irréversible.
          </p>

          <input type="hidden" name="periodId" value={periodId} />

          <div className="mt-4">
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
            >
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
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60"
            >
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
