"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteLoanAction } from "@/app/actions";
import { Modal } from "@/components/modal";
import { formatFcfa } from "@/lib/format";

export function DeleteLoanButton({
  loanId,
  periodId,
  memberLabel,
  amount,
  withdrawalFee,
  hasCashImpact,
}: {
  loanId: string;
  periodId: string;
  memberLabel: string;
  amount: number;
  withdrawalFee: number;
  hasCashImpact: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const cashOut = amount + (withdrawalFee || 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center justify-center rounded-lg p-2 text-[var(--muted)] transition hover:bg-red-50 hover:text-red-700"
        title="Supprimer le prêt"
        aria-label="Supprimer le prêt"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <Modal
        open={open}
        onClose={() => !deleting && setOpen(false)}
        title="Supprimer le prêt"
        description="Cette action est définitive."
      >
        <p className="text-sm text-[var(--muted)]">
          Confirmer la suppression de{" "}
          <strong className="font-mono text-[var(--navy)]">{loanId}</strong> (
          {formatFcfa(amount)}
          {withdrawalFee > 0 ? ` + frais ${formatFcfa(withdrawalFee)}` : ""}) pour{" "}
          <strong className="text-[var(--navy)]">{memberLabel}</strong> ?
        </p>
        {hasCashImpact ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
            La sortie caisse de {formatFcfa(cashOut)} sera annulée (argent
            remis en caisse).
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={deleting}
            onClick={() => setOpen(false)}
            className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              try {
                const fd = new FormData();
                fd.set("loanId", loanId);
                fd.set("periodId", periodId);
                await deleteLoanAction(fd);
                setOpen(false);
              } finally {
                setDeleting(false);
              }
            }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                Suppression…
              </>
            ) : (
              "Supprimer"
            )}
          </button>
        </div>
      </Modal>
    </>
  );
}
