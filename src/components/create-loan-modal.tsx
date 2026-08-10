"use client";

import { useMemo, useState } from "react";
import { Handshake } from "lucide-react";
import { createLoanAction } from "@/app/actions";
import { Modal } from "@/components/modal";
import { PhoneInput } from "@/components/phone-input";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label, Select } from "@/components/ui";
import { formatFcfa, formatPercent } from "@/lib/format";

type MemberOption = {
  id: string;
  lastName: string;
  firstName: string;
};

type LoanTontine = {
  id: string;
  name: string;
  members: MemberOption[];
  withdrawalFeeRate: number;
};

export function CreateLoanModal({
  tontines,
  defaultPeriodId,
}: {
  tontines: LoanTontine[];
  defaultPeriodId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const initialPeriodId =
    (defaultPeriodId && tontines.some((t) => t.id === defaultPeriodId)
      ? defaultPeriodId
      : tontines[0]?.id) || "";
  const [periodId, setPeriodId] = useState(initialPeriodId);
  const [amount, setAmount] = useState("");
  const [withdrawalFee, setWithdrawalFee] = useState("");
  const [feeTouched, setFeeTouched] = useState(false);

  const selected = useMemo(
    () => tontines.find((t) => t.id === periodId) ?? null,
    [tontines, periodId]
  );
  const members = selected?.members ?? [];
  const feeRate = selected?.withdrawalFeeRate ?? 0;
  const amountNum = Number(amount);
  const defaultFee =
    Number.isFinite(amountNum) && amountNum > 0
      ? Math.round(amountNum * feeRate)
      : null;

  const feeNum = Number(String(withdrawalFee).replace(",", "."));
  const feePreview =
    withdrawalFee.trim() === ""
      ? defaultFee
      : Number.isFinite(feeNum) && feeNum >= 0
        ? Math.round(feeNum)
        : null;

  function applyDefaultFee(nextAmount: string, nextPeriodId: string) {
    if (feeTouched) return;
    const t = tontines.find((x) => x.id === nextPeriodId);
    const n = Number(nextAmount);
    if (!t || !Number.isFinite(n) || n <= 0) {
      setWithdrawalFee("");
      return;
    }
    setWithdrawalFee(String(Math.round(n * t.withdrawalFeeRate)));
  }

  function resetForm() {
    setPeriodId(initialPeriodId);
    setAmount("");
    setWithdrawalFee("");
    setFeeTouched(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        disabled={tontines.length === 0}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1D2D50] px-4 py-2.5 text-sm font-semibold text-[#FFCD79] transition hover:bg-[#152238] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Handshake className="h-4 w-4" strokeWidth={1.75} />
        Nouveau prêt
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau prêt"
        description="Choisissez la tontine et le membre. Le prêt part en validation auprès de tous les gestionnaires avant décaissement."
        wide
      >
        {tontines.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Aucune tontine disponible.</p>
        ) : (
          <form
            action={async (fd) => {
              await createLoanAction(fd);
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
                  const next = e.target.value;
                  setPeriodId(next);
                  applyDefaultFee(amount, next);
                }}
              >
                {tontines.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Membre</Label>
              {members.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Aucun membre actif inscrit
                  {selected ? ` à « ${selected.name} »` : ""}.
                </p>
              ) : (
                <Select key={periodId} name="memberId" required defaultValue="">
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.lastName} {m.firstName}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date du prêt</Label>
                <Input name="date" type="date" required />
              </div>
              <div>
                <Label>Échéance</Label>
                <Input name="dueDate" type="date" required />
              </div>
            </div>
            <div>
              <Label>Montant (FCFA)</Label>
              <Input
                name="amount"
                type="number"
                min={1}
                required
                value={amount}
                onChange={(e) => {
                  const next = e.target.value;
                  setAmount(next);
                  applyDefaultFee(next, periodId);
                }}
              />
            </div>
            <div>
              <Label>Frais de retrait (FCFA) — optionnel</Label>
              <Input
                name="withdrawalFee"
                type="number"
                min={0}
                step={1}
                value={withdrawalFee}
                placeholder={
                  defaultFee != null ? String(defaultFee) : "0"
                }
                onChange={(e) => {
                  setFeeTouched(true);
                  setWithdrawalFee(e.target.value);
                }}
              />
              <p className="mt-1.5 rounded-lg bg-[var(--cream)] px-2.5 py-1.5 text-[11px] text-[var(--muted)]">
                Défaut paramètres : {formatPercent(feeRate)}
                {defaultFee != null ? ` → ${formatFcfa(defaultFee)}` : ""}.
                {feePreview != null && Number.isFinite(amountNum) && amountNum > 0
                  ? ` Sortie caisse : ${formatFcfa(amountNum + feePreview)}.`
                  : " Saisissez un montant pour voir le détail."}{" "}
                Laissez vide pour 0, ou modifiez le montant.
              </p>
            </div>
            <div>
              <Label>Témoin (obligatoire)</Label>
              <Input name="witnessName" required placeholder="Nom du témoin" />
            </div>
            <div>
              <Label>Tél. témoin</Label>
              <PhoneInput name="witnessPhone" showIcon={false} />
            </div>
            <div>
              <Label>Adresse témoin</Label>
              <Input name="witnessAddress" placeholder="optionnel" />
            </div>
            <div>
              <Label>Notes</Label>
              <Input name="notes" placeholder="optionnel" />
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
                disabled={members.length === 0}
              >
                Enregistrer le prêt
              </SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
