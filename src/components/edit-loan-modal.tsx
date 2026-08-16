"use client";

import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { Calendar, Handshake, Pencil, Percent, RotateCcw, Users, Wallet } from "lucide-react";
import { updateLoanAction, type UpdateLoanState } from "@/app/actions";
import { Modal } from "@/components/modal";
import { PhoneInput } from "@/components/phone-input";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label, Select } from "@/components/ui";
import { formatFcfa, formatPercent } from "@/lib/format";
import type { LoanWitness } from "@/lib/types";

type MemberOption = {
  id: string;
  lastName: string;
  firstName: string;
  phone?: string;
};

type RepayRow = { id?: string; date: string; amount: string };

export type EditLoanInitial = {
  id: string;
  memberId: string;
  memberLabel: string;
  date: string;
  dueDate: string;
  amount: number;
  withdrawalFee: number;
  applyInterest: boolean;
  interestExtra: number;
  interestMonth1: number;
  interestMonth2: number;
  totalDue: number;
  repaid: number;
  status: string;
  alreadySettled?: boolean;
  settledAt?: string;
  notes?: string;
  witnesses: LoanWitness[];
  repayments: { id: string; date: string; amount: number }[];
  pendingHistoricalRepayments?: { date: string; amount: number }[];
};

const fieldClass =
  "!rounded-xl border-[var(--line)] bg-white px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition focus:border-[var(--navy)]/25 focus:ring-[var(--navy)]/15";

function SectionTitle({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--cream)] text-[var(--navy)]">
        {icon}
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {children}
      </p>
    </div>
  );
}

function addMonthsIso(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1 + months, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function EditLoanModal({
  periodId,
  loan,
  members,
  interestRateMonthly,
  loanMaxDurationMonths,
  loanSecondWitnessThreshold,
}: {
  periodId: string;
  loan: EditLoanInitial;
  members: MemberOption[];
  interestRateMonthly: number;
  loanMaxDurationMonths: number;
  loanSecondWitnessThreshold: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<UpdateLoanState, FormData>(
    updateLoanAction,
    null
  );

  const [loanDate, setLoanDate] = useState(loan.date);
  const [dueDate, setDueDate] = useState(loan.dueDate);
  const [amount, setAmount] = useState(String(loan.amount));
  const [withdrawalFee, setWithdrawalFee] = useState(String(loan.withdrawalFee || 0));
  const [applyInterest, setApplyInterest] = useState(loan.applyInterest !== false);
  const [interestExtra, setInterestExtra] = useState(String(loan.interestExtra || 0));
  const [markSettled, setMarkSettled] = useState(
    loan.status === "Remboursé" || Boolean(loan.alreadySettled)
  );
  const [settledAt, setSettledAt] = useState(
    loan.settledAt || loan.dueDate || loan.date
  );
  const [notes, setNotes] = useState(loan.notes || "");

  const initialRepays: RepayRow[] = useMemo(() => {
    if (loan.repayments.length > 0) {
      return loan.repayments.map((r) => ({
        id: r.id,
        date: r.date,
        amount: String(r.amount),
      }));
    }
    return (loan.pendingHistoricalRepayments ?? []).map((r) => ({
      date: r.date,
      amount: String(r.amount),
    }));
  }, [loan]);

  const [repayRows, setRepayRows] = useState<RepayRow[]>(initialRepays);

  const w0 = loan.witnesses[0];
  const w1 = loan.witnesses[1];
  const [witness1Id, setWitness1Id] = useState(
    w0?.isGroupMember ? w0.memberId || "" : ""
  );
  const [witness2Mode, setWitness2Mode] = useState<"member" | "external">(
    w1 && !w1.isGroupMember ? "external" : "member"
  );
  const [witness2Id, setWitness2Id] = useState(
    w1?.isGroupMember ? w1.memberId || "" : ""
  );
  const [witness2Name, setWitness2Name] = useState(
    w1 && !w1.isGroupMember ? w1.name : ""
  );
  const [witness2Cip, setWitness2Cip] = useState(Boolean(w1?.cipProvided));

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state?.ok]);

  function resetFromLoan() {
    setLoanDate(loan.date);
    setDueDate(loan.dueDate);
    setAmount(String(loan.amount));
    setWithdrawalFee(String(loan.withdrawalFee || 0));
    setApplyInterest(loan.applyInterest !== false);
    setInterestExtra(String(loan.interestExtra || 0));
    setMarkSettled(loan.status === "Remboursé" || Boolean(loan.alreadySettled));
    setSettledAt(loan.settledAt || loan.dueDate || loan.date);
    setNotes(loan.notes || "");
    setRepayRows(initialRepays);
    setWitness1Id(w0?.isGroupMember ? w0.memberId || "" : "");
    setWitness2Mode(w1 && !w1.isGroupMember ? "external" : "member");
    setWitness2Id(w1?.isGroupMember ? w1.memberId || "" : "");
    setWitness2Name(w1 && !w1.isGroupMember ? w1.name : "");
    setWitness2Cip(Boolean(w1?.cipProvided));
  }

  const amountNum = Number(amount);
  const feeNum = Number(String(withdrawalFee).replace(",", "."));
  const extraNum = Number(String(interestExtra).replace(",", "."));
  const needTwo =
    Number.isFinite(amountNum) && amountNum > loanSecondWitnessThreshold;
  const maxDue = loanDate
    ? addMonthsIso(loanDate, loanMaxDurationMonths)
    : undefined;

  const interestPerMonth =
    applyInterest && Number.isFinite(amountNum) && amountNum > 0
      ? Math.round(amountNum * interestRateMonthly)
      : 0;

  const settleAsOf = markSettled && settledAt ? settledAt : null;
  const monthsAsOf = (() => {
    const end = settleAsOf || null;
    if (!loanDate || !dueDate) return 0;
    if (!end) {
      // Non soldé : aperçu selon échéance (contrat)
      if (dueDate <= loanDate) return 1;
      const [sy, sm, sd] = loanDate.split("-").map(Number);
      const [ey, em, ed] = dueDate.split("-").map(Number);
      if (!sy || !sm || !sd || !ey || !em || !ed) return 1;
      let months = (ey - sy) * 12 + (em - sm);
      if (ed < sd) months -= 1;
      return Math.min(loanMaxDurationMonths, Math.max(1, months));
    }
    // Soldé : mois complets jusqu’à la date de solde (plafonnés au contrat)
    if (end < loanDate) return 0;
    const [sy, sm, sd] = loanDate.split("-").map(Number);
    const [ey, em, ed] = end.split("-").map(Number);
    if (!sy || !sm || !sd || !ey || !em || !ed) return 0;
    let months = (ey - sy) * 12 + (em - sm);
    if (ed < sd) months -= 1;
    const contracted =
      dueDate <= loanDate
        ? 1
        : (() => {
            const [dy, dm, dd] = dueDate.split("-").map(Number);
            if (!dy || !dm || !dd) return 1;
            let c = (dy - sy) * 12 + (dm - sm);
            if (dd < sd) c -= 1;
            return Math.min(loanMaxDurationMonths, Math.max(1, c));
          })();
    return Math.min(loanMaxDurationMonths, Math.max(0, contracted), Math.max(0, months));
  })();

  const lateMonthsAsOf = (() => {
    if (!markSettled || !settleAsOf || !dueDate || settleAsOf <= dueDate) return 0;
    const [dy, dm, dd] = dueDate.split("-").map(Number);
    const [ty, tm, td] = settleAsOf.split("-").map(Number);
    if (!dy || !dm || !dd || !ty || !tm || !td) return 0;
    let months = (ty - dy) * 12 + (tm - dm);
    if (td < dd) months -= 1;
    return Math.max(1, months);
  })();

  const interestContract = applyInterest ? interestPerMonth * monthsAsOf : 0;
  const lateRate = 0.15;
  const interestExtraAuto =
    markSettled && applyInterest && lateMonthsAsOf > 0 && Number.isFinite(amountNum)
      ? lateMonthsAsOf * Math.round(amountNum * lateRate)
      : 0;
  const interestExtraPreview = markSettled
    ? interestExtraAuto
    : applyInterest && Number.isFinite(extraNum) && extraNum > 0
      ? Math.round(extraNum)
      : 0;
  const totalDuePreview =
    Number.isFinite(amountNum) && amountNum > 0
      ? amountNum + interestContract + interestExtraPreview
      : null;
  const repaidPreview = repayRows.reduce((s, r) => {
    const n = Number(String(r.amount).replace(",", "."));
    return s + (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
  }, 0);
  const remainingPreview =
    totalDuePreview != null
      ? Math.max(0, totalDuePreview - repaidPreview)
      : null;

  const witnessOptions = members.filter((m) => m.id !== loan.memberId);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetFromLoan();
          setOpen(true);
        }}
        className="inline-flex cursor-pointer items-center justify-center rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--cream)] hover:text-[var(--navy)]"
        title="Modifier le prêt"
        aria-label="Modifier le prêt"
      >
        <Pencil className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={`Modifier ${loan.id}`}
        description={`${loan.memberLabel} · statut ${loan.status}`}
        wide
        icon={<Handshake className="h-5 w-5" strokeWidth={1.75} />}
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      >
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="periodId" value={periodId} />
          <input type="hidden" name="loanId" value={loan.id} />

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
            {state?.error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {state.error}
              </p>
            )}

            <section>
              <SectionTitle icon={<Calendar className="h-3.5 w-3.5" strokeWidth={2} />}>
                Dates & montants
              </SectionTitle>
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date du prêt</Label>
                    <Input
                      name="date"
                      type="date"
                      required
                      value={loanDate}
                      className={fieldClass}
                      onChange={(e) => setLoanDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Échéance (max {loanMaxDurationMonths} mois)</Label>
                    <Input
                      name="dueDate"
                      type="date"
                      required
                      value={dueDate}
                      max={maxDue}
                      className={fieldClass}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Capital (FCFA)</Label>
                    <Input
                      name="amount"
                      type="number"
                      min={1}
                      required
                      value={amount}
                      className={`${fieldClass} tabular-nums`}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Frais de retrait</Label>
                    <Input
                      name="withdrawalFee"
                      type="number"
                      min={0}
                      value={withdrawalFee}
                      className={`${fieldClass} tabular-nums`}
                      onChange={(e) => setWithdrawalFee(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle icon={<Percent className="h-3.5 w-3.5" strokeWidth={2} />}>
                Intérêts
              </SectionTitle>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    name="applyInterest"
                    value="on"
                    checked={applyInterest}
                    onChange={(e) => {
                      setApplyInterest(e.target.checked);
                      if (!e.target.checked) setInterestExtra("0");
                    }}
                    className="mt-1 h-4 w-4 rounded border-[var(--line)] accent-[#1D2D50]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[var(--navy)]">
                      Intérêts appliqués
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      Taux contrat {formatPercent(interestRateMonthly)}. Décochez
                      pour un prêt sans intérêts.
                    </span>
                  </span>
                </label>
                {applyInterest && !markSettled && (
                  <div>
                    <Label>Intérêts de retard (FCFA)</Label>
                    <Input
                      name="interestExtra"
                      type="number"
                      min={0}
                      value={interestExtra}
                      className={`${fieldClass} tabular-nums`}
                      onChange={(e) => setInterestExtra(e.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      Remettre à 0 pour corriger un rattrapage indésirable. Le
                      passé sera gelé (pas de re-facturation auto).
                    </p>
                  </div>
                )}
                {(!applyInterest || markSettled) && (
                  <input
                    type="hidden"
                    name="interestExtra"
                    value={
                      markSettled
                        ? String(interestExtraPreview)
                        : "0"
                    }
                  />
                )}
                {applyInterest && markSettled && (
                  <p className="rounded-xl border border-[var(--line)] bg-[var(--cream)]/50 px-3 py-2 text-xs text-[var(--muted)]">
                    Intérêts recalculés selon la date du solde (
                    {monthsAsOf} mois × {formatPercent(interestRateMonthly)}
                    {interestExtraPreview > 0
                      ? ` + ${formatFcfa(interestExtraPreview)} de retard`
                      : ""}
                    ).
                  </p>
                )}
              </div>
            </section>

            <section>
              <SectionTitle icon={<RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />}>
                Tranches de remboursement
              </SectionTitle>
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setRepayRows((rows) => [
                        ...rows,
                        { date: dueDate || loanDate, amount: "" },
                      ])
                    }
                    className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:bg-[var(--cream)]"
                  >
                    + Ajouter une tranche
                  </button>
                </div>
                {repayRows.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Aucune tranche.</p>
                ) : (
                  <div className="space-y-2">
                    {repayRows.map((row, i) => (
                      <div
                        key={row.id ?? `new-${i}`}
                        className="grid grid-cols-[1fr_1fr_auto] gap-2"
                      >
                        {row.id ? (
                          <input type="hidden" name="repayId" value={row.id} />
                        ) : (
                          <input type="hidden" name="repayId" value="" />
                        )}
                        <Input
                          name="repayDate"
                          type="date"
                          value={row.date}
                          className={fieldClass}
                          onChange={(e) => {
                            const date = e.target.value;
                            setRepayRows((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, date } : r))
                            );
                          }}
                        />
                        <Input
                          name="repayAmount"
                          type="number"
                          min={1}
                          value={row.amount}
                          placeholder="Montant"
                          className={`${fieldClass} tabular-nums`}
                          onChange={(e) => {
                            const amount = e.target.value;
                            setRepayRows((rows) =>
                              rows.map((r, j) =>
                                j === i ? { ...r, amount } : r
                              )
                            );
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setRepayRows((rows) => rows.filter((_, j) => j !== i))
                          }
                          className="rounded-xl border border-[var(--line)] px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Retirer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section>
              <SectionTitle icon={<Users className="h-3.5 w-3.5" strokeWidth={2} />}>
                Cautions
              </SectionTitle>
              <div className="space-y-3.5">
                <div>
                  <Label>1ʳᵉ caution (membre)</Label>
                  <Select
                    required
                    value={witness1Id}
                    className={fieldClass}
                    onChange={(e) => setWitness1Id(e.target.value)}
                  >
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {witnessOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.lastName} {m.firstName}
                      </option>
                    ))}
                  </Select>
                  <input type="hidden" name="witness1Mode" value="member" />
                  <input type="hidden" name="witness1MemberId" value={witness1Id} />
                </div>

                {needTwo && (
                  <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[#FFFBF7] p-3.5">
                    <p className="text-xs font-semibold text-[var(--navy)]">
                      2ᵉ caution (montant &gt; {formatFcfa(loanSecondWitnessThreshold)})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setWitness2Mode("member")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          witness2Mode === "member"
                            ? "bg-[var(--navy)] text-[#FFCD79]"
                            : "border border-[var(--line)] bg-white text-[var(--navy)]"
                        }`}
                      >
                        Membre
                      </button>
                      <button
                        type="button"
                        onClick={() => setWitness2Mode("external")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          witness2Mode === "external"
                            ? "bg-[var(--navy)] text-[#FFCD79]"
                            : "border border-[var(--line)] bg-white text-[var(--navy)]"
                        }`}
                      >
                        Externe
                      </button>
                    </div>
                    <input type="hidden" name="witness2Mode" value={witness2Mode} />
                    {witness2Mode === "member" ? (
                      <>
                        <Select
                          value={witness2Id}
                          className={fieldClass}
                          onChange={(e) => setWitness2Id(e.target.value)}
                        >
                          <option value="" disabled>
                            Choisir…
                          </option>
                          {witnessOptions
                            .filter((m) => m.id !== witness1Id)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.lastName} {m.firstName}
                              </option>
                            ))}
                        </Select>
                        <input
                          type="hidden"
                          name="witness2MemberId"
                          value={witness2Id}
                        />
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          name="witness2Name"
                          value={witness2Name}
                          onChange={(e) => setWitness2Name(e.target.value)}
                          placeholder="Nom complet"
                          className={fieldClass}
                        />
                        <PhoneInput
                          name="witness2Phone"
                          showIcon={false}
                          defaultValue={w1?.phone || ""}
                        />
                        <label className="flex items-center gap-2 text-xs text-[var(--navy)]">
                          <input
                            type="checkbox"
                            name="witness2CipProvided"
                            value="on"
                            checked={witness2Cip}
                            onChange={(e) => setWitness2Cip(e.target.checked)}
                          />
                          CIP fournie
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section>
              <SectionTitle icon={<Wallet className="h-3.5 w-3.5" strokeWidth={2} />}>
                Statut & aperçu
              </SectionTitle>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    name="markSettled"
                    value="on"
                    checked={markSettled}
                    onChange={(e) => setMarkSettled(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[var(--line)] accent-[#1D2D50]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[var(--navy)]">
                      Marquer soldé (Remboursé)
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      Si le reste n’est pas couvert par les tranches, une tranche
                      de solde est ajoutée automatiquement.
                    </span>
                  </span>
                </label>
                {markSettled && (
                  <div>
                    <Label>Date du solde</Label>
                    <Input
                      name="settledAt"
                      type="date"
                      value={settledAt}
                      className={fieldClass}
                      onChange={(e) => setSettledAt(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <Label>Notes</Label>
                  <Input
                    name="notes"
                    value={notes}
                    className={fieldClass}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-gradient-to-br from-white to-[var(--cream)]/70 px-4 py-3 text-sm text-[var(--muted)]">
                  <p>
                    Dû estimé :{" "}
                    <strong className="text-[var(--navy)]">
                      {totalDuePreview != null
                        ? formatFcfa(totalDuePreview)
                        : "—"}
                    </strong>
                    {applyInterest
                      ? markSettled
                        ? ` (${monthsAsOf} mois × intérêts${
                            interestExtraPreview > 0
                              ? ` + retard ${formatFcfa(interestExtraPreview)}`
                              : ""
                          } = ${formatFcfa(interestContract + interestExtraPreview)})`
                        : ` (contrat ~${formatFcfa(interestContract)}${
                            interestExtraPreview > 0
                              ? ` + retard ${formatFcfa(interestExtraPreview)}`
                              : ""
                          })`
                      : " (sans intérêts)"}
                  </p>
                  <p className="mt-1">
                    Tranches :{" "}
                    <strong className="text-[var(--navy)]">
                      {formatFcfa(repaidPreview)}
                    </strong>
                    {remainingPreview != null ? (
                      <>
                        {" "}
                        · reste{" "}
                        <strong className="text-[var(--navy)]">
                          {formatFcfa(remainingPreview)}
                        </strong>
                      </>
                    ) : null}
                  </p>
                  {loan.status !== "En attente" && (
                    <p className="mt-2 text-[11px] text-amber-900">
                      La caisse (décaissement + remboursements) sera resynchronisée.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--line)] px-5 py-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] hover:bg-[var(--cream)] disabled:opacity-60"
            >
              Annuler
            </button>
            <SubmitButton pendingLabel="Enregistrement…">
              Enregistrer
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
