import { getDashboardStats, loanRemaining, memberDisplayName } from "@/lib/db/domain";
import { listEnrolledForPeriod } from "@/lib/db/collections";
import { listPeriods } from "@/lib/db/periods";
import { readCollectionForPeriodId } from "@/lib/db/store";
import { formatFcfa, formatPercent } from "@/lib/format";
import { DashboardTontineFilter } from "@/components/dashboard-tontine-filter";
import type { Contribution, Loan } from "@/lib/types";

export default async function GestionDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tontine?: string }>;
}) {
  const sp = await searchParams;
  const periods = await listPeriods();
  const periodId = sp.tontine?.trim() || periods[0]?.id || "";
  const period = periods.find((p) => p.id === periodId) ?? null;

  const stats = await getDashboardStats(periodId || undefined);

  const [members, contributions, loans] = period
    ? await Promise.all([
        listEnrolledForPeriod(period.id),
        readCollectionForPeriodId<Contribution>(period.id, "contributions"),
        readCollectionForPeriodId<Loan>(period.id, "loans"),
      ])
    : [[], [], []];

  const ranking = members
    .map((m) => ({
      member: m,
      total: contributions
        .filter((c) => c.memberId === m.id)
        .reduce((s, c) => s + c.amount, 0),
      loans: loans
        .filter((l) => l.memberId === m.id && (l.status === "En cours" || l.status === "En retard"))
        .reduce((s, l) => s + loanRemaining(l), 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
            Vue d’ensemble
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Tableau de bord
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Caisse = journal réel (cotisations, prêts, remboursements, pénalités payées).
          </p>
        </div>
        {periods.length > 0 && (
          <DashboardTontineFilter
            periods={periods.map((p) => ({ id: p.id, name: p.name }))}
            value={periodId}
          />
        )}
      </div>

      {!period ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          Créez une tontine pour voir le tableau de bord.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Total en caisse
              </p>
              <p
                className={`mt-1 font-[family-name:var(--font-display)] text-2xl font-bold ${
                  stats.cashBalance < 0 ? "text-red-700" : "text-[var(--navy)]"
                }`}
              >
                {formatFcfa(stats.cashBalance)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Cotisations totales
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {formatFcfa(stats.totalContributions)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Prêts octroyés
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {formatFcfa(stats.totalLoans)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Intérêts générés
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {formatFcfa(stats.totalInterest)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Membres actifs
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {stats.activeMembers}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Taux d’intérêt
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {formatPercent(stats.interestRate)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Pénalités non recouvrées
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {formatFcfa(stats.unpaidPenalties)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Montant dû (prêts)
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {formatFcfa(stats.loansDue)}
              </p>
            </div>
          </div>

          <section className="mt-10 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="text-sm font-semibold text-[var(--navy)]">Classement des cotisations</p>
              <p className="text-xs text-[var(--muted)]">{period.name}</p>
            </div>
            {ranking.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
                Aucun membre pour cette tontine.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-5 py-3 font-semibold">Rang</th>
                      <th className="px-3 py-3 font-semibold">Membre</th>
                      <th className="px-3 py-3 font-semibold">Total cotisé</th>
                      <th className="px-5 py-3 font-semibold">Prêts en cours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((row, i) => (
                      <tr
                        key={row.member.id}
                        className="border-b border-[var(--line)] last:border-0 transition hover:bg-[#FFF8EB]/50"
                      >
                        <td className="px-5 py-3.5 text-[var(--muted)]">{i + 1}</td>
                        <td className="px-3 py-3.5 font-medium text-[var(--navy)]">
                          {memberDisplayName(row.member)}
                        </td>
                        <td className="px-3 py-3.5 tabular-nums text-[var(--navy)]">
                          {formatFcfa(row.total)}
                        </td>
                        <td className="px-5 py-3.5 tabular-nums text-[var(--navy)]">
                          {formatFcfa(row.loans)}
                        </td>
                      </tr>
                    ))}
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
