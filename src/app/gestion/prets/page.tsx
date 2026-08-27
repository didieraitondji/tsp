import { Handshake, Wallet, AlertCircle, Clock } from "lucide-react";
import { CreateLoanModal } from "@/components/create-loan-modal";
import { DeleteLoanButton } from "@/components/delete-loan-button";
import { EditLoanModal } from "@/components/edit-loan-modal";
import { LoanApprovalActions } from "@/components/loan-approval-actions";
import { PretsTontineFilter } from "@/components/prets-tontine-filter";
import { listEnrolledForPeriod, usersRepo } from "@/lib/db/collections";
import {
  countRecentUnpaidSessions,
  loanRemaining,
  loanWitnessesOf,
  memberDisplayName,
  reconcileLateLoanInterest,
} from "@/lib/db/domain";
import { listPeriods } from "@/lib/db/periods";
import { DEFAULT_SETTINGS } from "@/lib/db/defaults";
import { todayIsoLocal } from "@/lib/cotisations-report";
import { readCollectionForPeriodId, readObjectForPeriodId } from "@/lib/db/store";
import { formatDate, formatFcfa } from "@/lib/format";
import { normalizeSearch } from "@/lib/search";
import { canApproveLoans, canInitiateLoans, canWriteGestion } from "@/lib/auth/permissions";
import { requireGestionAccess } from "@/lib/auth/session";
import type {
  Loan,
  LoanStatus,
  Repayment,
  User,
  Week,
  Contribution,
} from "@/lib/types";

function StatusPill({ status }: { status: LoanStatus }) {
  const styles =
    status === "En attente"
      ? "bg-sky-50 text-sky-900 ring-sky-200"
      : status === "En cours"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : status === "En retard"
          ? "bg-red-50 text-red-800 ring-red-200"
          : status === "Remboursé"
            ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
            : status === "Refusé"
              ? "bg-[var(--cream)] text-[var(--muted)] ring-[var(--line)]"
              : "bg-[var(--cream)] text-[var(--muted)] ring-[var(--line)]";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${styles}`}
    >
      {status}
    </span>
  );
}

function ApprovalProgress({
  loan,
  usersById,
}: {
  loan: Loan;
  usersById: Map<string, User>;
}) {
  const required = loan.requiredApproverIds ?? [];
  const approvals = loan.approvals ?? [];
  const approved = new Set(
    approvals.filter((a) => a.decision === "approved").map((a) => a.userId)
  );
  const quorumComplete = required.every((id) => approved.has(id));
  const superAdminApproval = approvals.find((a) => {
    if (a.decision !== "approved") return false;
    return usersById.get(a.userId)?.role === "SUPER_ADMIN";
  });
  const forcedBySuperAdmin =
    Boolean(superAdminApproval) &&
    !quorumComplete &&
    loan.status !== "En attente" &&
    loan.status !== "Refusé";

  return (
    <div className="space-y-1">
      {forcedBySuperAdmin ? (
        <p className="text-[11px] font-medium text-emerald-800">
          Quorum validé par super admin
          {superAdminApproval?.userName
            ? ` (${superAdminApproval.userName})`
            : ""}
        </p>
      ) : (
        <p className="text-[11px] text-[var(--muted)]">
          {approved.size}/{required.length} validation
          {required.length > 1 ? "s" : ""}
        </p>
      )}
      <ul className="space-y-0.5">
        {required.map((id) => {
          const u = usersById.get(id);
          const a = approvals.find((x) => x.userId === id);
          const mark = forcedBySuperAdmin
            ? "✓"
            : a?.decision === "approved"
              ? "✓"
              : a?.decision === "rejected"
                ? "✗"
                : "·";
          return (
            <li key={id} className="truncate text-[11px] text-[var(--navy)]">
              <span className="mr-1 font-semibold text-[var(--muted)]">{mark}</span>
              {u?.name ?? id}
            </li>
          );
        })}
      </ul>
      {loan.witnessName && (
        <p className="pt-1 text-[11px] text-[var(--muted)]">
          Caution : <span className="text-[var(--navy)]">{loan.witnessName}</span>
          {loan.witnessPhone ? ` · ${loan.witnessPhone}` : ""}
        </p>
      )}
      {loan.witnesses && loan.witnesses.length > 1 && (
        <p className="text-[11px] text-[var(--muted)]">
          + {loan.witnesses.length - 1} autre
          {loan.witnesses.length > 2 ? "s" : ""} caution
          {loan.witnesses.length > 2 ? "s" : ""}
        </p>
      )}
      {loan.interestExtra > 0 && (
        <p className="text-[11px] text-red-700">
          Intérêt retard {formatFcfa(loan.interestExtra)}
        </p>
      )}
    </div>
  );
}

export default async function PretsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tontine?: string;
    statut?: string;
    q?: string;
    du?: string;
    au?: string;
  }>;
}) {
  const session = await requireGestionAccess();
  const canWrite = canWriteGestion(session.user.role);
  const canInitiate = canInitiateLoans(session.user.role);
  const canApprove = canApproveLoans(session.user.role);

  const sp = await searchParams;
  const periods = await listPeriods();
  const periodId = sp.tontine?.trim() || periods[0]?.id || "";
  const period = periods.find((p) => p.id === periodId) ?? null;
  const statusFilter = sp.statut?.trim() || "all";
  const nameQuery = sp.q?.trim() || "";
  const dateFrom = sp.du?.trim() || "";
  const dateTo = sp.au?.trim() || "";

  if (period) {
    await reconcileLateLoanInterest(period.id);
  }

  const [members, users] = await Promise.all([
    period ? listEnrolledForPeriod(period.id) : Promise.resolve([]),
    usersRepo.all(),
  ]);
  const loans = period
    ? await readCollectionForPeriodId<Loan>(period.id, "loans")
    : [];
  const repayments = period
    ? await readCollectionForPeriodId<Repayment>(period.id, "repayments")
    : [];
  const repaymentLoanIds = new Set(repayments.map((r) => r.loanId));
  const repaymentsByLoan = new Map<string, Repayment[]>();
  for (const r of repayments) {
    const list = repaymentsByLoan.get(r.loanId) ?? [];
    list.push(r);
    repaymentsByLoan.set(r.loanId, list);
  }
  const byId = new Map(members.map((m) => [m.id, m]));
  const usersById = new Map(users.map((u) => [u.id, u]));
  const today = todayIsoLocal();

  const periodSettings = period
    ? await readObjectForPeriodId(period.id, "settings", DEFAULT_SETTINGS)
    : DEFAULT_SETTINGS;

  const loanTontines = await Promise.all(
    periods.map(async (p) => {
      const [enrolled, settings, pWeeks, pContribs] = await Promise.all([
        listEnrolledForPeriod(p.id),
        readObjectForPeriodId(p.id, "settings", DEFAULT_SETTINGS),
        readCollectionForPeriodId<Week>(p.id, "weeks"),
        readCollectionForPeriodId<Contribution>(p.id, "contributions"),
      ]);
      return {
        id: p.id,
        name: p.name,
        withdrawalFeeRate: settings.loanWithdrawalFeeRate,
        interestRateMonthly: settings.interestRateMonthly,
        interestRateExtra:
          Math.abs(
            (settings.interestRateExtra ?? DEFAULT_SETTINGS.interestRateExtra) -
              0.015
          ) < 1e-9
            ? 0.15
            : (settings.interestRateExtra ?? DEFAULT_SETTINGS.interestRateExtra),
        loanMaxDurationMonths: settings.loanMaxDurationMonths,
        loanSecondWitnessThreshold:
          settings.loanSecondWitnessThreshold ??
          DEFAULT_SETTINGS.loanSecondWitnessThreshold,
        members: enrolled
          .filter((m) => m.status === "Actif")
          .map((m) => ({
            id: m.id,
            lastName: m.lastName,
            firstName: m.firstName,
            phone: m.phone,
            unpaidRecent: countRecentUnpaidSessions(
              m.id,
              pWeeks,
              pContribs,
              today
            ),
          })),
      };
    })
  );

  const nameNeedle = nameQuery ? normalizeSearch(nameQuery) : "";
  const filtered = loans.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (dateFrom && l.date < dateFrom) return false;
    if (dateTo && l.date > dateTo) return false;
    if (nameNeedle) {
      const m = byId.get(l.memberId);
      const label = m ? memberDisplayName(m) : l.memberId;
      const hay = normalizeSearch([l.id, label].join(" "));
      if (!hay.includes(nameNeedle)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const hasListFilters =
    statusFilter !== "all" ||
    Boolean(nameQuery) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const pending = loans.filter((l) => l.status === "En attente");
  const enCours = loans.filter((l) => l.status === "En cours" || l.status === "En retard");
  const outstanding = enCours.reduce((s, l) => s + loanRemaining(l), 0);
  const totalAmount = loans
    .filter((l) => l.status !== "Refusé" && l.status !== "En attente")
    .reduce((s, l) => s + l.amount, 0);

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
            Opérations
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Prêts
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Demande avec caution(s) du groupe, validation par les gestionnaires, puis
            décaissement.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {canInitiate && periods.length > 0 && (
            <CreateLoanModal tontines={loanTontines} defaultPeriodId={periodId} />
          )}
        </div>
      </div>

      {!period ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          Créez une tontine pour gérer les prêts.
        </p>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-800">
                  <Clock className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    En attente
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                    {pending.length}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
                  <AlertCircle className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    En cours
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                    {enCours.length}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--cream)] text-[var(--sand)]">
                  <Wallet className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Solde restant
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--navy)]">
                    {formatFcfa(outstanding)}
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    Décaissé {formatFcfa(totalAmount)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[var(--navy)]">{period.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {sorted.length} prêt{sorted.length === 1 ? "" : "s"}
                  {hasListFilters ? " (filtrés)" : ""}
                  {statusFilter !== "all" ? ` · ${statusFilter}` : ""}
                </p>
              </div>
              <PretsTontineFilter
                periods={periods.map((p) => ({ id: p.id, name: p.name }))}
                value={periodId}
                status={statusFilter}
                q={nameQuery}
                du={dateFrom}
                au={dateTo}
              />
            </div>

            {sorted.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--cream)] text-[var(--sand)]">
                  <Handshake className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <p className="mt-4 font-semibold text-[var(--navy)]">Aucun prêt</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">
                  {hasListFilters
                    ? "Aucun prêt ne correspond à ces filtres."
                    : loans.length === 0
                      ? canInitiate
                        ? "Enregistrez le premier prêt via Nouveau prêt."
                        : "Aucun prêt pour cette tontine."
                      : "Aucun prêt ne correspond à ce filtre."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-5 py-3 font-semibold">Prêt</th>
                      <th className="px-3 py-3 font-semibold">Montant</th>
                      <th className="px-3 py-3 font-semibold">Validations</th>
                      <th className="px-3 py-3 font-semibold">Statut</th>
                      <th className="px-5 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((l) => {
                      const m = byId.get(l.memberId);
                      const alreadyVoted = (l.approvals ?? []).some(
                        (a) => a.userId === session.user.id
                      );
                      const inQuorum =
                        session.user.role === "SUPER_ADMIN" ||
                        (l.requiredApproverIds ?? []).includes(session.user.id);
                      const canDecide =
                        canApprove &&
                        l.status === "En attente" &&
                        inQuorum &&
                        !alreadyVoted;
                      const canDelete =
                        canWrite &&
                        l.repaid === 0 &&
                        !repaymentLoanIds.has(l.id);
                      const hasCashImpact =
                        Boolean(l.disbursedAt) ||
                        l.status === "En cours" ||
                        l.status === "En retard";
                      const witnesses = loanWitnessesOf(l);
                      const needsCip = witnesses.some((w) => !w.isGroupMember);

                      return (
                        <tr
                          key={l.id}
                          className="border-b border-[var(--line)] last:border-0 transition hover:bg-[#FFF8EB]/50"
                        >
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-[var(--navy)]">
                              {m ? memberDisplayName(m) : l.memberId}
                            </p>
                            <p className="font-mono text-[11px] text-[var(--muted)]">{l.id}</p>
                            <p className="text-[11px] text-[var(--muted)]">
                              {formatDate(l.date)} · échéance {formatDate(l.dueDate)}
                            </p>
                            {witnesses.length > 0 && (
                              <p className="mt-1 text-[11px] text-[var(--muted)]">
                                Caution
                                {witnesses.length > 1 ? "s" : ""} :{" "}
                                {witnesses
                                  .map(
                                    (w) =>
                                      `${w.name}${w.isGroupMember ? "" : " (ext.)"}`
                                  )
                                  .join(" · ")}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <p className="tabular-nums font-medium text-[var(--navy)]">
                              {formatFcfa(l.amount)}
                            </p>
                            <p className="text-[11px] tabular-nums text-[var(--muted)]">
                              frais retrait {formatFcfa(l.withdrawalFee || 0)}
                            </p>
                            <p className="text-[11px] tabular-nums text-[var(--muted)]">
                              dû aujourd’hui {formatFcfa(l.totalDue)}
                              {l.status === "En cours" || l.status === "En retard"
                                ? ` · reste ${formatFcfa(loanRemaining(l))}`
                                : ""}
                            </p>
                            {l.applyInterest === false && (
                              <p className="text-[11px] font-medium text-emerald-800">
                                Sans intérêts
                              </p>
                            )}
                            {l.alreadySettled && (
                              <p className="text-[11px] font-medium text-emerald-800">
                                Solde historique
                                {l.settledAt
                                  ? ` · ${formatDate(l.settledAt)}`
                                  : ""}
                              </p>
                            )}
                            {l.interestExtra > 0 && (
                              <p className="text-[11px] tabular-nums text-red-700">
                                dont retard {formatFcfa(l.interestExtra)}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <ApprovalProgress loan={l} usersById={usersById} />
                          </td>
                          <td className="px-3 py-3.5">
                            <StatusPill status={l.status} />
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <LoanApprovalActions
                                periodId={period.id}
                                loanId={l.id}
                                canDecide={canDecide}
                                needsCip={needsCip}
                                isSuperAdmin={session.user.role === "SUPER_ADMIN"}
                              />
                              {canWrite && l.status !== "Refusé" ? (
                                <EditLoanModal
                                  periodId={period.id}
                                  members={members
                                    .filter((x) => x.status === "Actif")
                                    .map((x) => ({
                                      id: x.id,
                                      lastName: x.lastName,
                                      firstName: x.firstName,
                                      phone: x.phone,
                                    }))}
                                  interestRateMonthly={
                                    periodSettings.interestRateMonthly
                                  }
                                  loanMaxDurationMonths={
                                    periodSettings.loanMaxDurationMonths || 2
                                  }
                                  loanSecondWitnessThreshold={
                                    periodSettings.loanSecondWitnessThreshold ??
                                    DEFAULT_SETTINGS.loanSecondWitnessThreshold
                                  }
                                  loan={{
                                    id: l.id,
                                    memberId: l.memberId,
                                    memberLabel: m
                                      ? memberDisplayName(m)
                                      : l.memberId,
                                    date: l.date,
                                    dueDate: l.dueDate,
                                    amount: l.amount,
                                    withdrawalFee: l.withdrawalFee || 0,
                                    applyInterest: l.applyInterest !== false,
                                    interestExtra: l.interestExtra || 0,
                                    interestMonth1: l.interestMonth1 || 0,
                                    interestMonth2: l.interestMonth2 || 0,
                                    totalDue: l.totalDue,
                                    repaid: l.repaid,
                                    status: l.status,
                                    alreadySettled: l.alreadySettled,
                                    settledAt: l.settledAt,
                                    notes: l.notes,
                                    witnesses: loanWitnessesOf(l),
                                    repayments: (
                                      repaymentsByLoan.get(l.id) ?? []
                                    )
                                      .slice()
                                      .sort((a, b) =>
                                        a.date.localeCompare(b.date)
                                      )
                                      .map((r) => ({
                                        id: r.id,
                                        date: r.date,
                                        amount: r.amount,
                                      })),
                                    pendingHistoricalRepayments:
                                      l.pendingHistoricalRepayments,
                                  }}
                                />
                              ) : null}
                              {canDelete ? (
                                <DeleteLoanButton
                                  loanId={l.id}
                                  periodId={period.id}
                                  memberLabel={
                                    m ? memberDisplayName(m) : l.memberId
                                  }
                                  amount={l.amount}
                                  withdrawalFee={l.withdrawalFee || 0}
                                  hasCashImpact={hasCashImpact}
                                />
                              ) : null}
                            </div>
                            {l.status === "En attente" && alreadyVoted && (
                              <p className="text-[11px] text-[var(--muted)]">Déjà voté</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
