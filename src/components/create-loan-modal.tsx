"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Calendar, Handshake, UserRound, Wallet } from "lucide-react";
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

  const cashOut =
    Number.isFinite(amountNum) && amountNum > 0 && feePreview != null
      ? amountNum + feePreview
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
        description="Validation par les gestionnaires avant décaissement en caisse."
        wide
        icon={<Handshake className="h-5 w-5" strokeWidth={1.75} />}
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      >
        {tontines.length === 0 ? (
          <div className="px-5 py-5">
            <p className="text-sm text-[var(--muted)]">Aucune tontine disponible.</p>
          </div>
        ) : (
          <form
            action={async (fd) => {
              await createLoanAction(fd);
              setOpen(false);
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <section>
                <SectionTitle icon={<UserRound className="h-3.5 w-3.5" strokeWidth={2} />}>
                  Bénéficiaire
                </SectionTitle>
                <div className="space-y-3.5">
                  <div>
                    <Label>Tontine</Label>
                    <Select
                      name="periodId"
                      required
                      value={periodId}
                      className={fieldClass}
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
                      <Select
                        key={periodId}
                        name="memberId"
                        required
                        defaultValue=""
                        className={fieldClass}
                      >
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
                </div>
              </section>

              <section>
                <SectionTitle icon={<Calendar className="h-3.5 w-3.5" strokeWidth={2} />}>
                  Dates & montants
                </SectionTitle>
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Date du prêt</Label>
                      <Input name="date" type="date" required className={fieldClass} />
                    </div>
                    <div>
                      <Label>Échéance</Label>
                      <Input name="dueDate" type="date" required className={fieldClass} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Montant (FCFA)</Label>
                      <Input
                        name="amount"
                        type="number"
                        min={1}
                        required
                        value={amount}
                        className={`${fieldClass} tabular-nums`}
                        onChange={(e) => {
                          const next = e.target.value;
                          setAmount(next);
                          applyDefaultFee(next, periodId);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Frais de retrait — optionnel</Label>
                      <Input
                        name="withdrawalFee"
                        type="number"
                        min={0}
                        step={1}
                        value={withdrawalFee}
                        placeholder={defaultFee != null ? String(defaultFee) : "0"}
                        className={`${fieldClass} tabular-nums`}
                        onChange={(e) => {
                          setFeeTouched(true);
                          setWithdrawalFee(e.target.value);
                        }}
                      />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-white to-[var(--cream)]/70">
                    <div className="flex items-start gap-3 px-4 py-3.5">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--navy)]/90 text-[#FFCD79]">
                        <Wallet className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          Sortie caisse
                        </p>
                        <p className="mt-0.5 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums tracking-tight text-[var(--navy)]">
                          {cashOut != null ? formatFcfa(cashOut) : "—"}
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                          Défaut frais : {formatPercent(feeRate)}
                          {defaultFee != null ? ` → ${formatFcfa(defaultFee)}` : ""}.
                          {feePreview != null && amountNum > 0
                            ? ` Montant ${formatFcfa(amountNum)} + frais ${formatFcfa(feePreview)}.`
                            : " Saisissez un montant pour le détail."}{" "}
                          Champ frais vide = 0 FCFA.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <SectionTitle icon={<Handshake className="h-3.5 w-3.5" strokeWidth={2} />}>
                  Témoin & notes
                </SectionTitle>
                <div className="space-y-3.5">
                  <div>
                    <Label>Témoin (obligatoire)</Label>
                    <Input
                      name="witnessName"
                      required
                      placeholder="Nom du témoin"
                      className={fieldClass}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Tél. témoin</Label>
                      <PhoneInput name="witnessPhone" showIcon={false} />
                    </div>
                    <div>
                      <Label>Adresse témoin</Label>
                      <Input
                        name="witnessAddress"
                        placeholder="optionnel"
                        className={fieldClass}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input name="notes" placeholder="optionnel" className={fieldClass} />
                  </div>
                </div>
              </section>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] bg-[#FFFBF7] px-5 py-3.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
              >
                Annuler
              </button>
              <SubmitButton
                className="!rounded-full !bg-[var(--navy)] !px-5 !py-2.5 !text-[#FFCD79] hover:!bg-[var(--brand-dark)]"
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
