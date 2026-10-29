"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { deleteRepaymentAction } from "@/app/actions";
import { Modal } from "@/components/modal";
import { formatFcfa } from "@/lib/format";

export function DeleteRepaymentButton({
  repaymentId,
  periodId,
  loanId,
  memberLabel,
  amount,
  dateLabel,
}: {
  repaymentId: string;
  periodId: string;
  loanId: string;
  memberLabel: string;
  amount: number;
  dateLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center justify-center rounded-lg p-2 text-[var(--muted)] transition hover:bg-amber-50 hover:text-amber-900"
        title="Annuler le remboursement"
        aria-label="Annuler le remboursement"
      >
        <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <Modal
        open={open}
        onClose={() => !deleting && setOpen(false)}
        title="Annuler le remboursement"
        description="Ce remboursement sera retiré. Le solde du prêt et la caisse seront mis à jour."
      >
        <p className="text-sm text-[var(--muted)]">
          Confirmer l’annulation de{" "}
          <strong className="text-[var(--navy)]">{formatFcfa(amount)}</strong>{" "}
          du {dateLabel} sur{" "}
          <strong className="font-mono text-[var(--navy)]">{loanId}</strong> (
          {memberLabel}) ?
        </p>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
          L’entrée caisse liée sera retirée. Si ce dépôt était une mise, saisissez-la
          ensuite dans les cotisations.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={deleting}
            onClick={() => setOpen(false)}
            className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Fermer
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              try {
                const fd = new FormData();
                fd.set("repaymentId", repaymentId);
                fd.set("periodId", periodId);
                await deleteRepaymentAction(fd);
                setOpen(false);
              } finally {
                setDeleting(false);
              }
            }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-amber-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                Annulation…
              </>
            ) : (
              "Annuler le remboursement"
            )}
          </button>
        </div>
      </Modal>
    </>
  );
}
