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
  const [loanId, setLoanId] = useState("");
  const [amount, setAmount] = useState("");

  const loans = useMemo(
    () => tontines.find((t) => t.id === periodId)?.loans ?? [],
    [tontines, periodId]
  );
  const selectedLoan = loans.find((l) => l.id === loanId);
  const remaining = selectedLoan?.remaining ?? 0;
  const selectedName = tontines.find((t) => t.id === periodId)?.name;
  const hasAnyLoan = tontines.some((t) => t.loans.length > 0);

  const resetForm = () => {
    setPeriodId(initialPeriodId);
    setLoanId("");
    setAmount("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetForm();
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
        description="Saisissez une tranche libre : le prêt reste ouvert tant que le solde n’est pas à zéro."
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
                onChange={(e) => {
                  setPeriodId(e.target.value);
                  setLoanId("");
                  setAmount("");
                }}
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
                <Select
                  key={periodId}
                  name="loanId"
                  required
                  value={loanId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setLoanId(id);
                    const loan = loans.find((l) => l.id === id);
                    setAmount(loan ? String(loan.remaining) : "");
                  }}
                >
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

            {selectedLoan && (
              <div className="rounded-xl border border-[#FFCD79]/50 bg-[#FFF8EB] px-3.5 py-3 text-sm text-[var(--navy)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Solde restant
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-display)] text-lg font-bold tabular-nums">
                  {formatFcfa(remaining)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Montant libre : une partie ou la totalité. Vous pourrez enregistrer
                  d’autres tranches plus tard.
                </p>
              </div>
            )}

            <div>
              <Label>Date</Label>
              <Input
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div>
              <Label>Montant de la tranche (FCFA)</Label>
              <Input
                name="amount"
                type="number"
                min={1}
                max={remaining > 0 ? remaining : undefined}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!selectedLoan}
              />
              {selectedLoan && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAmount(String(remaining))}
                    className="cursor-pointer rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11px] font-semibold text-[var(--navy)] transition hover:border-[#FFCD79]"
                  >
                    Tout rembourser ({formatFcfa(remaining)})
                  </button>
                  {remaining > 1000 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAmount(String(Math.max(1, Math.round(remaining / 2))))
                      }
                      className="cursor-pointer rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11px] font-semibold text-[var(--navy)] transition hover:border-[#FFCD79]"
                    >
                      Moitié
                    </button>
                  )}
                </div>
              )}
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
                disabled={loans.length === 0 || !loanId}
              >
                Enregistrer la tranche
              </SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
