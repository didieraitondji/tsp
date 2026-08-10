"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateEnrollmentTargetAction } from "@/app/actions";
import { formatFcfa } from "@/lib/format";

export function EditWeeklyTargetButton({
  periodId,
  memberId,
  memberLabel,
  currentTarget,
  onUpdated,
  compact = false,
}: {
  periodId: string;
  memberId: string;
  memberLabel: string;
  currentTarget: number;
  onUpdated?: (weeklyTarget: number) => void;
  /** Style discret pour la colonne Cible de la grille */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(currentTarget));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) setValue(String(currentTarget));
  }, [open, currentTarget]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  const save = () => {
    setError(null);
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Montant invalide.");
      return;
    }
    const fd = new FormData();
    fd.set("periodId", periodId);
    fd.set("memberId", memberId);
    fd.set("weeklyTarget", String(amount));
    start(async () => {
      const result = await updateEnrollmentTargetAction(fd);
      if (!result?.ok) {
        setError(result?.error ?? "Échec");
        return;
      }
      onUpdated?.(result.weeklyTarget);
      if (!onUpdated) router.refresh();
      setOpen(false);
    });
  };

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-0.5 inline-flex cursor-pointer items-center gap-0.5 text-[9px] font-semibold text-[var(--muted)] transition hover:text-[var(--navy)]"
          title="Modifier la cible"
        >
          <Pencil className="h-2.5 w-2.5" strokeWidth={2} />
          <span className="max-sm:hidden">Modifier</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--cream)]"
          title="Modifier la mise"
        >
          <Pencil className="h-3 w-3" strokeWidth={1.75} />
          Mise
        </button>
      )}

      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[min(calc(100%-2rem),22rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--line)] bg-white p-0 shadow-[0_24px_60px_-20px_rgba(21,34,56,0.45)] backdrop:bg-black/45"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--navy)]">
              Modifier la cible
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
            Mise de <strong className="text-[var(--navy)]">{memberLabel}</strong>. Actuel :{" "}
            {formatFcfa(currentTarget)}. Les séances déjà marquées ne changent pas.
          </p>
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Nouvelle cible (FCFA)
            </span>
            <input
              type="number"
              min={1}
              step={100}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--navy)] outline-none focus:border-[#FFCD79] focus:ring-2 focus:ring-[#FFCD79]/35"
            />
          </label>
          {error && (
            <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="cursor-pointer rounded-full bg-[#1D2D50] px-3 py-1.5 text-sm font-semibold text-[#FFCD79] disabled:opacity-60"
            >
              {pending ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
