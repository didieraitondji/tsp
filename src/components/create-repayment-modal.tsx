"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { createRepaymentAction } from "@/app/actions";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label, Select } from "@/components/ui";
import { formatFcfa } from "@/lib/format";

type OpenLoanOption = {
  id: string;
  label: string;
  remaining: number;
};

type TontineLoans = {
  id: string;
  name: string;
  loans: OpenLoanOption[];
};

export function CreateRepaymentModal({
  tontines,
  defaultPeriodId,
}: {
  tontines: TontineLoans[];
  defaultPeriodId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const initialPeriodId =
    (defaultPeriodId && tontines.some((t) => t.id === defaultPeriodId)
      ? defaultPeriodId
      : tontines[0]?.id) || "";
  const [periodId, setPeriodId] = useState(initialPeriodId);

  const loans = useMemo(
    () => tontines.find((t) => t.id === periodId)?.loans ?? [],
    [tontines, periodId]
  );
  const selectedName = tontines.find((t) => t.id === periodId)?.name;
  const hasAnyLoan = tontines.some((t) => t.loans.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPeriodId(initialPeriodId);
          setOpen(true);
        }}
        disabled={!hasAnyLoan}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1D2D50] px-4 py-2.5 text-sm font-semibold text-[#FFCD79] transition hover:bg-[#152238] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
        Nouveau remboursement
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau remboursement"
        description="Choisissez la tontine, puis un prêt en cours à rembourser."
      >
        {!hasAnyLoan ? (
          <p className="text-sm text-[var(--muted)]">
            Aucun prêt remboursable pour le moment.
          </p>
        ) : (
          <form
            action={async (fd) => {
              await createRepaymentAction(fd);
              setOpen(false);
            }}
            className="space-y-3.5"
          >
            <div>
              <Label>Tontine</Label>
              <Select
                name="periodId"
                required
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                {tontines.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.loans.length === 0 ? " (aucun prêt ouvert)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Prêt</Label>
              {loans.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Aucun prêt en cours
                  {selectedName ? ` sur « ${selectedName} »` : ""}.
                </p>
              ) : (
                <Select key={periodId} name="loanId" required defaultValue="">
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {loans.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label} — reste {formatFcfa(l.remaining)}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div>
              <Label>Date</Label>
              <Input name="date" type="date" required />
            </div>
            <div>
              <Label>Montant (FCFA)</Label>
              <Input name="amount" type="number" min={1} required />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
              >
                Annuler
              </button>
              <SubmitButton
                className="!rounded-full"
                pendingLabel="Enregistrement…"
                disabled={loans.length === 0}
              >
                Enregistrer
              </SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
