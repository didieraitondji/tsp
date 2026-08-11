"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Calendar, Handshake, UserRound, Users, Wallet } from "lucide-react";
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
  phone?: string;
  unpaidRecent?: number;
};

type LoanTontine = {
  id: string;
  name: string;
  members: MemberOption[];
  withdrawalFeeRate: number;
  interestRateMonthly: number;
  interestRateExtra: number;
  loanMaxDurationMonths: number;
  loanSecondWitnessThreshold: number;
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

function contractedMonths(
  loanDate: string,
  dueDate: string,
  maxMonths: number
): number {
  if (!loanDate || !dueDate || dueDate <= loanDate) return 1;
  const [sy, sm, sd] = loanDate.split("-").map(Number);
  const [ey, em, ed] = dueDate.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 1;
  let months = (ey - sy) * 12 + (em - sm);
  if (ed < sd) months -= 1;
  if (months < 1) months = 1;
  return Math.min(Math.max(1, maxMonths), Math.max(1, months));
}

function accruedNormalMonths(
  loanDate: string,
  todayIso: string,
  contracted: number
): number {
  if (!loanDate || todayIso < loanDate) return 0;
  const [fy, fm, fd] = loanDate.split("-").map(Number);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  const elapsed = Math.max(0, months);
  return Math.min(2, Math.max(0, contracted), elapsed);
}

/** Mois de retard complets après échéance (au moins 1 dès le lendemain). */
function lateMonthsSince(dueDate: string, todayIso: string): number {
  if (!dueDate || todayIso <= dueDate) return 0;
  const [dy, dm, dd] = dueDate.split("-").map(Number);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  if (!dy || !dm || !dd || !ty || !tm || !td) return 0;
  let months = (ty - dy) * 12 + (tm - dm);
  if (td < dd) months -= 1;
  return Math.max(1, months);
}

/** Ancien défaut 1,5 % → traiter comme 15 % (règle bureau). */
function effectiveLateRate(rate: number | undefined): number {
  if (rate == null || !Number.isFinite(rate)) return 0.15;
  if (Math.abs(rate - 0.015) < 1e-9) return 0.15;
  return rate;
}

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [memberId, setMemberId] = useState("");
  const [loanDate, setLoanDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [withdrawalFee, setWithdrawalFee] = useState("");
  const [feeTouched, setFeeTouched] = useState(false);
  const [witness1Id, setWitness1Id] = useState("");
  const [witness2Mode, setWitness2Mode] = useState<"member" | "external">("member");
  const [witness2Id, setWitness2Id] = useState("");
  const [witness2Name, setWitness2Name] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => tontines.find((t) => t.id === periodId) ?? null,
    [tontines, periodId]
  );
  const members = selected?.members ?? [];
  const feeRate = selected?.withdrawalFeeRate ?? 0;
  const interestRate = selected?.interestRateMonthly ?? 0.1;
  const lateRate = effectiveLateRate(selected?.interestRateExtra);
  const maxMonths = selected?.loanMaxDurationMonths ?? 2;
  const threshold = selected?.loanSecondWitnessThreshold ?? 20000;
  const amountNum = Number(amount);
  const needTwo = Number.isFinite(amountNum) && amountNum > threshold;
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

  const today = todayIsoLocal();
  const contractMonths =
    loanDate && dueDate
      ? contractedMonths(loanDate, dueDate, maxMonths)
      : null;
  const accruedMonths =
    loanDate && contractMonths != null
      ? accruedNormalMonths(loanDate, today, contractMonths)
      : null;
  const monthsLate =
    dueDate && Number.isFinite(amountNum) && amountNum > 0
      ? lateMonthsSince(dueDate, today)
      : 0;
  const interestPerMonth =
    Number.isFinite(amountNum) && amountNum > 0
      ? Math.round(amountNum * interestRate)
      : null;
  const interestAccrued =
    interestPerMonth != null && accruedMonths != null
      ? interestPerMonth * accruedMonths
      : null;
  const interestAtDue =
    interestPerMonth != null && contractMonths != null
      ? interestPerMonth * contractMonths
      : null;
  const lateInterest =
    monthsLate > 0 && Number.isFinite(amountNum) && amountNum > 0
      ? monthsLate * Math.round(amountNum * lateRate)
      : 0;
  const totalDueNow =
    interestAccrued != null && Number.isFinite(amountNum)
      ? amountNum + interestAccrued + lateInterest
      : null;
  const totalDueAtTerm =
    interestAtDue != null && Number.isFinite(amountNum)
      ? amountNum + interestAtDue
      : null;
  const pastDue = monthsLate > 0;

  const borrowerAlert = members.find((m) => m.id === memberId);
  const miseBienWarn = (borrowerAlert?.unpaidRecent ?? 0) >= 2;

  const witnessOptions = members.filter((m) => m.id !== memberId);

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
    setMemberId("");
    setLoanDate("");
    setDueDate("");
    setAmount("");
    setWithdrawalFee("");
    setFeeTouched(false);
    setWitness1Id("");
    setWitness2Mode("member");
    setWitness2Id("");
    setWitness2Name("");
    setError(null);
  }

  function onLoanDateChange(next: string) {
    setLoanDate(next);
    if (next && selected) {
      setDueDate(addMonthsIso(next, maxMonths));
    }
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
        description="Cautions du groupe, validation gestionnaires, puis décaissement."
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
              setError(null);
              if (loanDate && dueDate) {
                const maxDue = addMonthsIso(loanDate, maxMonths);
                if (dueDate > maxDue) {
                  setError(
                    `Échéance max : ${maxDue} (${maxMonths} mois après la date du prêt).`
                  );
                  return;
                }
              }
              if (!witness1Id) {
                setError("La 1ʳᵉ caution doit être un membre actif de la tontine.");
                return;
              }
              if (needTwo) {
                if (witness2Mode === "member" && !witness2Id) {
                  setError("2ᵉ caution membre requise au-delà du seuil.");
                  return;
                }
                if (witness2Mode === "external" && witness2Name.trim().length < 2) {
                  setError("Nom de la 2ᵉ caution externe requis.");
                  return;
                }
              }
              fd.set("witness1Mode", "member");
              fd.set("witness1MemberId", witness1Id);
              if (needTwo) {
                fd.set("witness2Mode", witness2Mode);
                if (witness2Mode === "member") {
                  fd.set("witness2MemberId", witness2Id);
                }
              }
              await createLoanAction(fd);
              setOpen(false);
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </p>
              )}

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
                        setMemberId("");
                        setWitness1Id("");
                        setWitness2Id("");
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
                        value={memberId}
                        className={fieldClass}
                        onChange={(e) => {
                          setMemberId(e.target.value);
                          if (witness1Id === e.target.value) setWitness1Id("");
                          if (witness2Id === e.target.value) setWitness2Id("");
                        }}
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
                  {miseBienWarn && (
                    <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                      <p>
                        Alerte « mise bien » : au moins{" "}
                        <strong>{borrowerAlert?.unpaidRecent}</strong> séances récentes
                        non payées. Le prêt reste possible.
                      </p>
                    </div>
                  )}
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
                      <Input
                        name="date"
                        type="date"
                        required
                        value={loanDate}
                        className={fieldClass}
                        onChange={(e) => onLoanDateChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Échéance (max {maxMonths} mois)</Label>
                      <Input
                        name="dueDate"
                        type="date"
                        required
                        value={dueDate}
                        max={loanDate ? addMonthsIso(loanDate, maxMonths) : undefined}
                        className={fieldClass}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
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
                      {needTwo && (
                        <p className="mt-1 text-[11px] text-[var(--sand)]">
                          Au-delà de {formatFcfa(threshold)} : 2 cautions requises.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Frais de retrait (à la charge du demandeur)</Label>
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
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                            Sortie caisse
                          </p>
                          <p className="mt-0.5 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums tracking-tight text-[var(--navy)]">
                            {cashOut != null ? formatFcfa(cashOut) : "—"}
                          </p>
                          <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                            Frais {formatPercent(feeRate)}
                            {feePreview != null && amountNum > 0
                              ? ` · ${formatFcfa(amountNum)} + ${formatFcfa(feePreview)}`
                              : ""}
                            . À la charge du demandeur.
                          </p>
                        </div>
                        <div className="border-t border-[var(--line)]/70 pt-2 text-[12px] leading-relaxed text-[var(--muted)]">
                          {contractMonths != null ? (
                            <>
                              Contrat : {contractMonths} mois ×{" "}
                              {formatPercent(interestRate)}
                              {interestAtDue != null
                                ? ` = ${formatFcfa(interestAtDue)}`
                                : ""}
                              {totalDueAtTerm != null ? (
                                <>
                                  {" "}
                                  · Dû à l’échéance{" "}
                                  <strong className="text-[var(--navy)]">
                                    {formatFcfa(totalDueAtTerm)}
                                  </strong>
                                </>
                              ) : null}
                              <br />
                              {pastDue ? (
                                <>
                                  Échéance dépassée : {monthsLate} mois de retard ×{" "}
                                  {formatPercent(lateRate)} sur capital
                                  {lateInterest > 0
                                    ? ` = ${formatFcfa(lateInterest)}`
                                    : ""}
                                  . Intérêts contrat courus :{" "}
                                  {accruedMonths ?? 0}/{contractMonths} mois
                                  {interestAccrued != null
                                    ? ` (${formatFcfa(interestAccrued)})`
                                    : ""}
                                  .
                                  {totalDueNow != null ? (
                                    <>
                                      {" "}
                                      <strong className="text-red-800">
                                        Dû aujourd’hui {formatFcfa(totalDueNow)}
                                      </strong>
                                    </>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  Couru à ce jour : {accruedMonths ?? 0} mois
                                  {interestAccrued != null
                                    ? ` = ${formatFcfa(interestAccrued)}`
                                    : ""}
                                  {totalDueNow != null ? (
                                    <>
                                      {" "}
                                      · Dû aujourd’hui{" "}
                                      <strong className="text-[var(--navy)]">
                                        {formatFcfa(totalDueNow)}
                                      </strong>
                                    </>
                                  ) : null}
                                  . Après l’échéance : {formatPercent(lateRate)} /
                                  mois sur capital restant.
                                </>
                              )}
                            </>
                          ) : (
                            <>Indiquez les dates pour calculer les intérêts.</>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <SectionTitle icon={<Users className="h-3.5 w-3.5" strokeWidth={2} />}>
                  Cautions
                </SectionTitle>
                <div className="space-y-3.5">
                  <div>
                    <Label>1ʳᵉ caution (membre de la tontine)</Label>
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
                        2ᵉ caution (montant &gt; {formatFcfa(threshold)})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setWitness2Mode("member")}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            witness2Mode === "member"
                              ? "bg-[var(--navy)] text-[#FFCD79]"
                              : "border border-[var(--line)] bg-white text-[var(--navy)]"
                          }`}
                        >
                          Membre tontine
                        </button>
                        <button
                          type="button"
                          onClick={() => setWitness2Mode("external")}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            witness2Mode === "external"
                              ? "bg-[var(--navy)] text-[#FFCD79]"
                              : "border border-[var(--line)] bg-white text-[var(--navy)]"
                          }`}
                        >
                          Externe
                        </button>
                      </div>
                      {witness2Mode === "member" ? (
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
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <Label>Nom</Label>
                            <Input
                              name="witness2Name"
                              value={witness2Name}
                              onChange={(e) => setWitness2Name(e.target.value)}
                              placeholder="Nom de la caution"
                              className={fieldClass}
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label>Tél.</Label>
                              <PhoneInput name="witness2Phone" showIcon={false} />
                            </div>
                            <div>
                              <Label>Adresse</Label>
                              <Input
                                name="witness2Address"
                                placeholder="optionnel"
                                className={fieldClass}
                              />
                            </div>
                          </div>
                          <label className="flex items-start gap-2 text-sm text-[var(--navy)]">
                            <input
                              type="checkbox"
                              name="witness2CipProvided"
                              className="mt-1"
                            />
                            <span>
                              Copie CIP à fournir (caution hors tontine) — à vérifier à
                              l’approbation.
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

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
