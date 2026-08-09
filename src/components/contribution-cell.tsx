"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Check, Lock, Unlock, X } from "lucide-react";
import {
  markContributionAction,
  unlockContributionAction,
  type UnlockContributionState,
} from "@/app/actions";
import { PasswordInput } from "@/components/password-input";
import { todayIsoLocal } from "@/lib/cotisations-report";
import { formatFcfa } from "@/lib/format";
import type { ContributionStatus } from "@/lib/types";

export function ContributionCell({
  periodId,
  memberId,
  weekId,
  weekDate,
  weeklyTarget,
  penaltyAmount,
  amount,
  status,
  locked,
  onSaved,
}: {
  periodId: string;
  memberId: string;
  weekId: string;
  /** Date ISO de la séance — Impayé masqué si future */
  weekDate: string;
  weeklyTarget: number;
  penaltyAmount: number;
  amount: number;
  status: "none" | ContributionStatus;
  locked: boolean;
  onSaved?: (next: {
    amount: number;
    locked: boolean;
    status: ContributionStatus;
  }) => void;
}) {
  const [pending, start] = useTransition();
  const [localAmount, setLocalAmount] = useState(amount);
  const [localStatus, setLocalStatus] = useState(status);
  const [localLocked, setLocalLocked] = useState(locked);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [confirmUnpaid, setConfirmUnpaid] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [state, formAction, unlocking] = useActionState<UnlockContributionState, FormData>(
    unlockContributionAction,
    null
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  /** Évite que d’anciennes props n’écrasent un marquage venant d’être sauvé. */
  const pendingSaveRef = useRef(false);
  const expectedRef = useRef<{
    amount: number;
    status: ContributionStatus;
    locked: boolean;
  } | null>(null);

  // Sync props → local (sauf pendant / juste après une sauvegarde locale)
  useEffect(() => {
    if (pendingSaveRef.current || pending) return;
    if (expectedRef.current) {
      const e = expectedRef.current;
      const caughtUp =
        status === e.status && locked === e.locked && amount === e.amount;
      if (!caughtUp) return;
      expectedRef.current = null;
    }
    setLocalAmount(amount);
    setLocalStatus(status);
    setLocalLocked(locked);
  }, [amount, status, locked, pending, periodId, memberId, weekId]);

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
    const el = confirmRef.current;
    if (!el) return;
    if (confirmUnpaid) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [confirmUnpaid]);

  useEffect(() => {
    if (!state?.ok) return;
    setUnlockOpen(false);
    setLocalLocked(false);
    expectedRef.current = {
      amount: localAmount,
      status: localStatus === "none" ? "paid" : localStatus,
      locked: false,
    };
    if (localStatus === "paid" || localStatus === "unpaid") {
      onSaved?.({ amount: localAmount, locked: false, status: localStatus });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to unlock success
  }, [state?.ok]);

  const isLocked =
    localLocked && (localStatus === "paid" || localStatus === "unpaid");
  const canMarkUnpaid = weekDate <= todayIsoLocal();
  const paidLabel = canMarkUnpaid ? "Payé" : "Avancé";
  const paidTitle = canMarkUnpaid
    ? `Payé · ${formatFcfa(weeklyTarget)}`
    : `Avance · ${formatFcfa(weeklyTarget)}`;

  const mark = (nextStatus: ContributionStatus) => {
    if (isLocked || pending) return;
    if (localStatus === nextStatus && localLocked) return;

    pendingSaveRef.current = true;
    setSaveError(null);
    const fd = new FormData();
    fd.set("periodId", periodId);
    fd.set("memberId", memberId);
    fd.set("weekId", weekId);
    fd.set("status", nextStatus);
    fd.set("weeklyTarget", String(weeklyTarget));
    start(async () => {
      try {
        const result = await markContributionAction(fd);
        if (!result.ok) {
          setSaveError(result.error ?? "Échec");
          pendingSaveRef.current = false;
          return;
        }
        // Fermer la modale avant de basculer l’UI verrouillée
        setConfirmUnpaid(false);
        expectedRef.current = {
          amount: result.amount,
          status: result.status,
          locked: result.locked,
        };
        setLocalAmount(result.amount);
        setLocalLocked(result.locked);
        setLocalStatus(result.status);
        onSaved?.({
          amount: result.amount,
          locked: result.locked,
          status: result.status,
        });
      } finally {
        pendingSaveRef.current = false;
      }
    });
  };

  return (
    <div className="flex min-w-[6.25rem] flex-col items-stretch gap-0.5">
      {isLocked ? (
        <>
          <div
            className={`flex items-center justify-center gap-1 rounded-lg border px-1.5 py-1 text-[11px] font-semibold shadow-sm ${
              localStatus === "paid"
                ? "border-emerald-200 bg-gradient-to-b from-emerald-50 to-emerald-100/80 text-emerald-900"
                : "border-red-200 bg-gradient-to-b from-red-50 to-red-100/70 text-red-800"
            }`}
            title={
              localStatus === "paid"
                ? canMarkUnpaid
                  ? formatFcfa(localAmount)
                  : `Avance · ${formatFcfa(localAmount)}`
                : "Impayé"
            }
          >
            <Lock className="h-3 w-3 shrink-0 opacity-70" strokeWidth={1.75} />
            {localStatus === "paid" ? (
              <>
                <Check className="h-3 w-3 shrink-0" strokeWidth={2.25} />
                <span className="tabular-nums">
                  {canMarkUnpaid
                    ? formatFcfa(localAmount).replace(" FCFA", "")
                    : `Av. ${formatFcfa(localAmount).replace(" FCFA", "")}`}
                </span>
              </>
            ) : (
              <span>Impayé</span>
            )}
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
        </>
      ) : (
        <>
          <div className={`flex gap-1 ${pending ? "opacity-70" : ""}`}>
            <button
              type="button"
              disabled={pending}
              onClick={() => mark("paid")}
              className={`cursor-pointer rounded-lg border px-1 py-1 text-[10px] font-semibold transition disabled:cursor-wait ${
                canMarkUnpaid ? "flex-1" : "w-full"
              } ${
                localStatus === "paid"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-[var(--line)] bg-white text-[var(--navy)] hover:border-emerald-300 hover:bg-emerald-50/60"
              }`}
              title={paidTitle}
            >
              {paidLabel}
            </button>
            {canMarkUnpaid && (
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmUnpaid(true)}
                className={`flex-1 cursor-pointer rounded-lg border px-1 py-1 text-[10px] font-semibold transition disabled:cursor-wait ${
                  localStatus === "unpaid"
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-[var(--line)] bg-white text-[var(--navy)] hover:border-red-300 hover:bg-red-50/60"
                }`}
                title="Impayé · pénalité"
              >
                Impayé
              </button>
            )}
          </div>
          {saveError && (
            <p className="text-[9px] leading-tight text-red-600" title={saveError}>
              {saveError.length > 24 ? "Erreur" : saveError}
            </p>
          )}
        </>
      )}

      {/* Toujours montées pour pouvoir fermer proprement (évite les modales fantômes) */}
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
            Confirmez avec votre mot de passe pour modifier ce marquage.
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

      <dialog
        ref={confirmRef}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[min(calc(100%-2rem),22rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--line)] bg-white p-0 shadow-[0_24px_60px_-20px_rgba(21,34,56,0.45)] backdrop:bg-black/45"
        onClose={() => setConfirmUnpaid(false)}
        onClick={(e) => {
          if (e.target === confirmRef.current) setConfirmUnpaid(false);
        }}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--navy)]">
              Marquer impayé
            </h3>
            <button
              type="button"
              onClick={() => setConfirmUnpaid(false)}
              className="cursor-pointer rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--cream)]"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Une pénalité de{" "}
            <strong className="font-semibold text-[var(--navy)]">
              {formatFcfa(penaltyAmount)}
            </strong>{" "}
            sera attribuée. Elle restera même si vous marquez ensuite comme payé.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmUnpaid(false)}
              className="cursor-pointer rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => mark("unpaid")}
              className="cursor-pointer rounded-full bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "…" : "Confirmer"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
