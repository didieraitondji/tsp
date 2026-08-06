"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Lock, Unlock, X } from "lucide-react";
import {
  saveContributionAction,
  unlockContributionAction,
  type UnlockContributionState,
} from "@/app/actions";
import { PasswordInput } from "@/components/password-input";
import { formatFcfa } from "@/lib/format";

export function ContributionCell({
  periodId,
  memberId,
  weekId,
  amount,
  locked,
  onSaved,
}: {
  periodId: string;
  memberId: string;
  weekId: string;
  amount: number;
  locked: boolean;
  onSaved?: (next: { amount: number; locked: boolean }) => void;
}) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState(amount > 0 ? String(amount) : "");
  const [localAmount, setLocalAmount] = useState(amount);
  const [localLocked, setLocalLocked] = useState(locked);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [state, formAction, unlocking] = useActionState<UnlockContributionState, FormData>(
    unlockContributionAction,
    null
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const savingRef = useRef(false);

  // Sync from parent only when not mid-save (ex. changement de tontine)
  useEffect(() => {
    if (!pending && !savingRef.current) {
      setLocalAmount(amount);
      setLocalLocked(locked);
      setValue(amount > 0 ? String(amount) : "");
    }
  }, [amount, locked, pending]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (unlockOpen) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [unlockOpen]);

  useEffect(() => {
    if (!state?.ok) return;
    setUnlockOpen(false);
    setLocalLocked(false);
    onSaved?.({ amount: localAmount, locked: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to unlock success
  }, [state?.ok]);

  const isLocked = localLocked && localAmount > 0;

  const commit = () => {
    const parsed = Number(value);
    const nextAmount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    if (nextAmount === localAmount || (nextAmount === 0 && localAmount === 0)) return;

    savingRef.current = true;
    setSaveError(null);
    const fd = new FormData();
    fd.set("periodId", periodId);
    fd.set("memberId", memberId);
    fd.set("weekId", weekId);
    fd.set("amount", String(nextAmount));
    start(async () => {
      try {
        const result = await saveContributionAction(fd);
        if (!result.ok) {
          setSaveError(result.error ?? "Échec");
          setValue(localAmount > 0 ? String(localAmount) : "");
          return;
        }
        setLocalAmount(result.amount);
        setLocalLocked(result.locked);
        setValue(result.amount > 0 ? String(result.amount) : "");
        onSaved?.({ amount: result.amount, locked: result.locked });
      } finally {
        savingRef.current = false;
      }
    });
  };

  return (
    <div className="flex min-w-[5.5rem] flex-col items-stretch gap-0.5">
      {isLocked ? (
        <>
          <div className="flex items-center justify-end gap-1 rounded border border-[var(--line)] bg-[var(--cream)]/50 px-1.5 py-1 text-right text-xs tabular-nums text-[var(--navy)]">
            <Lock className="h-3 w-3 shrink-0 text-[var(--muted)]" strokeWidth={1.75} />
            <span>{formatFcfa(localAmount).replace(" FCFA", "")}</span>
          </div>
          <button
            type="button"
            onClick={() => setUnlockOpen(true)}
            className="inline-flex cursor-pointer items-center justify-center gap-0.5 text-[10px] font-medium text-[var(--muted)] transition hover:text-[var(--navy)]"
            title="Déverrouiller"
          >
            <Unlock className="h-3 w-3" strokeWidth={1.75} />
            Déverr.
          </button>

          <dialog
            ref={dialogRef}
            className="fixed left-1/2 top-1/2 z-50 m-0 w-[min(calc(100%-2rem),22rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--line)] bg-white p-0 shadow-[0_24px_60px_-20px_rgba(21,34,56,0.45)] backdrop:bg-black/45"
            onClose={() => setUnlockOpen(false)}
            onClick={(e) => {
              if (e.target === dialogRef.current) setUnlockOpen(false);
            }}
          >
            <form action={formAction} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--navy)]">
                  Déverrouiller
                </h3>
                <button
                  type="button"
                  onClick={() => setUnlockOpen(false)}
                  className="cursor-pointer rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--cream)]"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Confirmez avec votre mot de passe pour modifier cette cotisation.
              </p>
              <input type="hidden" name="periodId" value={periodId} />
              <input type="hidden" name="memberId" value={memberId} />
              <input type="hidden" name="weekId" value={weekId} />
              <div className="mt-3">
                <PasswordInput name="password" required autoComplete="current-password" />
              </div>
              {state?.error && (
                <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">
                  {state.error}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUnlockOpen(false)}
                  className="cursor-pointer rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={unlocking}
                  className="cursor-pointer rounded-full bg-[#1D2D50] px-3 py-1.5 text-sm font-semibold text-[#FFCD79] disabled:opacity-60"
                >
                  {unlocking ? "…" : "Déverrouiller"}
                </button>
              </div>
            </form>
          </dialog>
        </>
      ) : (
        <>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className={`w-full rounded border border-[var(--line)] bg-white px-1 py-1 text-right text-xs outline-none focus:ring-1 focus:ring-[var(--brand)] ${
              pending ? "opacity-70" : ""
            }`}
            placeholder="—"
            aria-busy={pending}
          />
          {saveError && (
            <p className="text-[9px] leading-tight text-red-600" title={saveError}>
              Erreur
            </p>
          )}
        </>
      )}
    </div>
  );
}
