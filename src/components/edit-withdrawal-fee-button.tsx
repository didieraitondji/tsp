"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import {
  updateLoanWithdrawalFeeAction,
  type UpdateWithdrawalFeeState,
} from "@/app/actions";
import { PasswordInput } from "@/components/password-input";
import { formatPercent } from "@/lib/format";

export function EditWithdrawalFeeButton({
  periodId,
  tontineName,
  currentRate,
}: {
  periodId: string;
  tontineName: string;
  currentRate: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<UpdateWithdrawalFeeState, FormData>(
    updateLoanWithdrawalFeeAction,
    null
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const percentDefault = Number((currentRate * 100).toFixed(2));

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state?.ok]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--cream)]"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
        Modifier le taux
      </button>

      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[min(calc(100%-2rem),24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--line)] bg-white p-0 shadow-[0_24px_60px_-20px_rgba(21,34,56,0.45)] backdrop:bg-black/45"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        <form action={formAction} className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
              Frais de retrait prêt
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--cream)]"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Tontine « {tontineName} ». Actuel : {formatPercent(currentRate)}. Le nouveau taux
            s’applique aux <strong className="font-semibold text-[var(--navy)]">prochains</strong>{" "}
            prêts (les prêts déjà créés gardent leurs frais figés).
          </p>

          <input type="hidden" name="periodId" value={periodId} />

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Nouveau taux (%)
            </label>
            <input
              name="loanWithdrawalFeeRate"
              type="number"
              min={0}
              max={100}
              step={0.1}
              required
              defaultValue={percentDefault}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--navy)] outline-none ring-[var(--brand)] focus:ring-2"
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Ex. 2 pour 2 %, 2,5 pour 2,5 %. Déduit de la caisse au décaissement.
            </p>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Mot de passe
            </label>
            <PasswordInput name="password" required autoComplete="current-password" />
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
            <button
              type="submit"
              disabled={pending}
              className="cursor-pointer rounded-full bg-[#1D2D50] px-4 py-2 text-sm font-semibold text-[#FFCD79] transition hover:bg-[#152238] disabled:opacity-60"
            >
              {pending ? "Enregistrement…" : "Valider"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
