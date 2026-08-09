import { RotateCcw, Wallet, Receipt } from "lucide-react";
import { CreateRepaymentModal } from "@/components/create-repayment-modal";
import { RemboursementsTontineFilter } from "@/components/remboursements-tontine-filter";
import { listEnrolledForPeriod } from "@/lib/db/collections";
import { loanRemaining, memberDisplayName } from "@/lib/db/domain";
import { listPeriods } from "@/lib/db/periods";
import { readCollectionForPeriodId } from "@/lib/db/store";
import { formatDate, formatFcfa } from "@/lib/format";
import { canWriteGestion } from "@/lib/auth/permissions";
import { requireGestionAccess } from "@/lib/auth/session";
import type { Loan, Repayment } from "@/lib/types";

export default async function RemboursementsPage({
  searchParams,
}: {
  searchParams: Promise<{ tontine?: string }>;
}) {
  const session = await requireGestionAccess();
  const canWrite = canWriteGestion(session.user.role);

  const sp = await searchParams;
  const periods = await listPeriods();
  const periodId = sp.tontine?.trim() || periods[0]?.id || "";
  const period = periods.find((p) => p.id === periodId) ?? null;

  const members = period ? await listEnrolledForPeriod(period.id) : [];
  const byMember = new Map(members.map((m) => [m.id, m]));

  const loans = period
    ? await readCollectionForPeriodId<Loan>(period.id, "loans")
    : [];
  const repayments = period
    ? await readCollectionForPeriodId<Repayment>(period.id, "repayments")
    : [];

  const openLoans = loans.filter(
    (l) => l.status === "En cours" || l.status === "En retard"
  );

  const repaymentTontines = await Promise.all(
    periods.map(async (p) => {
      const periodLoans = await readCollectionForPeriodId<Loan>(p.id, "loans");
      const enrolled = await listEnrolledForPeriod(p.id);
      const memberMap = new Map(enrolled.map((m) => [m.id, m]));
      return {
        id: p.id,
        name: p.name,
        loans: periodLoans
          .filter((l) => l.status === "En cours" || l.status === "En retard")
          .map((l) => {
            const m = memberMap.get(l.memberId);
            return {
              id: l.id,
              label: `${l.id} — ${m ? memberDisplayName(m) : l.memberId}`,
              remaining: loanRemaining(l),
            };
          }),
      };
    })
  );

  const sorted = [...repayments].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );
  const totalRepaid = repayments.reduce((s, r) => s + r.amount, 0);
  const remainingOpen = openLoans.reduce((s, l) => s + loanRemaining(l), 0);

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
            Opérations
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Remboursements
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Remboursements libres en une ou plusieurs tranches. Le prêt reste ouvert
            jusqu’à extinction du solde.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && periods.length > 0 && (
            <CreateRepaymentModal
              tontines={repaymentTontines}
              defaultPeriodId={periodId}
            />
          )}
        </div>
      </div>

      {!period ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          Créez une tontine pour gérer les remboursements.
        </p>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1D2D50] text-[#FFCD79]">
                  <Receipt className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Opérations
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                    {repayments.length}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                  <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Total remboursé
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--navy)]">
                    {formatFcfa(totalRepaid)}
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
                    Solde prêts ouverts
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--navy)]">
                    {formatFcfa(remainingOpen)}
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    {openLoans.length} prêt{openLoans.length === 1 ? "" : "s"} ouvert
                    {openLoans.length === 1 ? "" : "s"}
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
                  {sorted.length} remboursement{sorted.length === 1 ? "" : "s"}
                </p>
              </div>
              <RemboursementsTontineFilter
                periods={periods.map((p) => ({ id: p.id, name: p.name }))}
                value={periodId}
              />
            </div>

            {sorted.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--cream)] text-[var(--sand)]">
                  <RotateCcw className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <p className="mt-4 font-semibold text-[var(--navy)]">Aucun remboursement</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">
                  {canWrite
                    ? "Enregistrez le premier remboursement via le bouton ci-dessus."
                    : "Aucun remboursement pour cette tontine."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-3 py-3 font-semibold">Prêt / Membre</th>
                      <th className="px-3 py-3 font-semibold">Montant</th>
                      <th className="px-3 py-3 font-semibold">Capital</th>
                      <th className="px-3 py-3 font-semibold">Intérêts</th>
                      <th className="px-5 py-3 font-semibold">Solde restant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r) => {
                      const loan = loans.find((l) => l.id === r.loanId);
                      const m = loan ? byMember.get(loan.memberId) : undefined;
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-[var(--line)] last:border-0 transition hover:bg-[#FFF8EB]/50"
                        >
                          <td className="px-5 py-3.5 text-[var(--muted)]">
                            {formatDate(r.date)}
                          </td>
                          <td className="px-3 py-3.5">
                            <p className="font-mono text-xs text-[var(--muted)]">{r.loanId}</p>
                            <p className="font-medium text-[var(--navy)]">
                              {m ? memberDisplayName(m) : loan?.memberId ?? "—"}
                            </p>
                          </td>
                          <td className="px-3 py-3.5 tabular-nums font-medium text-[var(--navy)]">
                            {formatFcfa(r.amount)}
                          </td>
                          <td className="px-3 py-3.5 tabular-nums text-[var(--muted)]">
                            {formatFcfa(r.capital)}
                          </td>
                          <td className="px-3 py-3.5 tabular-nums text-[var(--muted)]">
                            {formatFcfa(r.interest)}
                          </td>
                          <td className="px-5 py-3.5 tabular-nums font-medium text-[var(--navy)]">
                            {formatFcfa(r.remainingBalance)}
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
