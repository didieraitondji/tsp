import Link from "next/link";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Handshake,
  Wallet,
} from "lucide-react";
import type {
  DashboardActionLoan,
  DashboardCashPreview,
  DashboardRankingRow,
} from "@/lib/db/domain";
import { formatDate, formatFcfa } from "@/lib/format";

export type GestionDashboardStats = {
  cashBalance: number;
  totalContributions: number;
  totalLoans: number;
  totalInterest: number;
  unpaidPenalties: number;
  unpaidPenaltiesCount: number;
  loansDue: number;
  pendingLoansCount: number;
  lateLoansCount: number;
  nextWeek: { id: string; date: string } | null;
  sessionPaidCount: number;
  sessionActiveCount: number;
  actionLoans: DashboardActionLoan[];
  recentCash: DashboardCashPreview[];
  ranking: DashboardRankingRow[];
};

function withTontine(href: string, periodId: string): string {
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}tontine=${encodeURIComponent(periodId)}`;
}

function weekdayShort(isoDate: string): string {
  const labels = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."] as const;
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  return labels[new Date(y, m - 1, d).getDay()] ?? "";
}

function LoanStatusPill({ status }: { status: DashboardActionLoan["status"] }) {
  const styles =
    status === "En attente"
      ? "bg-sky-50 text-sky-900 ring-sky-200"
      : status === "En retard"
        ? "bg-red-50 text-red-800 ring-red-200"
        : "bg-[var(--cream)] text-[var(--muted)] ring-[var(--line)]";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${styles}`}
    >
      {status}
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p
        className={`mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums ${
          warn ? "text-red-700" : "text-[var(--navy)]"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function GestionDashboard({
  periodId,
  periodName,
  stats,
}: {
  periodId: string;
  periodName: string;
  stats: GestionDashboardStats;
}) {
  const hasAlerts =
    stats.pendingLoansCount > 0 ||
    stats.lateLoansCount > 0 ||
    stats.unpaidPenaltiesCount > 0;

  const sessionPct =
    stats.sessionActiveCount > 0
      ? Math.round((stats.sessionPaidCount / stats.sessionActiveCount) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {hasAlerts && (
        <div className="flex flex-wrap gap-2">
          {stats.pendingLoansCount > 0 && (
            <Link
              href={withTontine(
                "/gestion/prets?statut=En%20attente",
                periodId
              )}
              className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-sm font-medium text-sky-950 transition hover:bg-sky-100"
            >
              <Clock className="h-3.5 w-3.5" strokeWidth={2} />
              {stats.pendingLoansCount} prêt
              {stats.pendingLoansCount > 1 ? "s" : ""} en attente
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          {stats.lateLoansCount > 0 && (
            <Link
              href={withTontine("/gestion/prets?statut=En%20retard", periodId)}
              className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3.5 py-1.5 text-sm font-medium text-red-900 transition hover:bg-red-100"
            >
              <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} />
              {stats.lateLoansCount} prêt
              {stats.lateLoansCount > 1 ? "s" : ""} en retard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          {stats.unpaidPenaltiesCount > 0 && (
            <Link
              href={withTontine("/gestion/penalites?statut=impaye", periodId)}
              className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-sm font-medium text-amber-950 transition hover:bg-amber-100"
            >
              <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} />
              {stats.unpaidPenaltiesCount} pénalité
              {stats.unpaidPenaltiesCount > 1 ? "s" : ""} non payée
              {stats.unpaidPenaltiesCount > 1 ? "s" : ""}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Total en caisse"
          value={formatFcfa(stats.cashBalance)}
          warn={stats.cashBalance < 0}
        />
        <KpiCard
          label="Cotisations totales"
          value={formatFcfa(stats.totalContributions)}
        />
        <KpiCard label="Prêts octroyés" value={formatFcfa(stats.totalLoans)} />
        <KpiCard
          label="Intérêts générés"
          value={formatFcfa(stats.totalInterest)}
        />
        <KpiCard
          label="Montant dû (prêts)"
          value={formatFcfa(stats.loansDue)}
        />
        <KpiCard
          label="Pénalités non recouvrées"
          value={formatFcfa(stats.unpaidPenalties)}
          hint={
            stats.unpaidPenaltiesCount > 0
              ? `${stats.unpaidPenaltiesCount} dossier${
                  stats.unpaidPenaltiesCount > 1 ? "s" : ""
                }`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[#152238] p-5 text-[#F4E4D7] shadow-[0_1px_0_rgba(29,45,80,0.04)] md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FFCD79]/80">
            Prochaine séance
          </p>
          {stats.nextWeek ? (
            <>
              <p className="mt-3 text-sm text-[#F4E4D7]/70">
                {weekdayShort(stats.nextWeek.date)}
              </p>
              <p className="mt-0.5 font-[family-name:var(--font-display)] text-2xl font-bold text-white md:text-3xl">
                {formatDate(stats.nextWeek.date)}
              </p>
              <div className="mt-5">
                <div className="flex items-end justify-between gap-2 text-sm">
                  <span className="text-[#F4E4D7]/70">Marquage</span>
                  <span className="font-semibold tabular-nums text-[#FFCD79]">
                    {stats.sessionPaidCount}/{stats.sessionActiveCount} ·{" "}
                    {sessionPct} %
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#FFCD79] transition-all"
                    style={{ width: `${sessionPct}%` }}
                  />
                </div>
              </div>
              <Link
                href={withTontine("/gestion/cotisations", periodId)}
                className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#FFCD79] transition hover:text-white"
              >
                Ouvrir les cotisations
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
            </>
          ) : (
            <div className="mt-4 flex min-h-[8rem] flex-col justify-center">
              <CalendarDays className="h-8 w-8 text-[#FFCD79]/70" strokeWidth={1.5} />
              <p className="mt-3 font-semibold text-white">Saison sans séance à venir</p>
              <p className="mt-1 text-sm text-[#F4E4D7]/65">
                Toutes les séances sont passées ou aucune n’est planifiée.
              </p>
              <Link
                href={withTontine("/gestion/cotisations", periodId)}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#FFCD79] transition hover:text-white"
              >
                Voir les cotisations
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_1px_0_rgba(29,45,80,0.04)]">
          <div className="flex items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
                <Handshake className="h-4 w-4 text-[var(--sand)]" strokeWidth={1.75} />
                Prêts à traiter
              </h2>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {stats.actionLoans.length === 0
                  ? "Rien en attente"
                  : `${stats.pendingLoansCount} attente · ${stats.lateLoansCount} retard`}
              </p>
            </div>
            <Link
              href={withTontine("/gestion/prets", periodId)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sand)] hover:text-[var(--navy)]"
            >
              Tout voir <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="p-4">
            {stats.actionLoans.length === 0 ? (
              <p className="rounded-xl bg-[var(--cream)]/50 px-4 py-8 text-center text-sm text-[var(--muted)]">
                Aucun prêt en attente ni en retard.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {stats.actionLoans.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[#FFFBF7] px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--navy)]">
                        {l.memberName}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
                        {l.id}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums text-[var(--navy)]">
                        {formatFcfa(
                          l.status === "En attente" ? l.amount : l.remaining
                        )}
                      </p>
                      <div className="mt-1 flex justify-end">
                        <LoanStatusPill status={l.status} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_1px_0_rgba(29,45,80,0.04)]">
          <div className="flex items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
                <Wallet className="h-4 w-4 text-[var(--sand)]" strokeWidth={1.75} />
                Derniers mouvements
              </h2>
              <p className="mt-0.5 text-sm text-[var(--muted)]">Journal de caisse</p>
            </div>
            <Link
              href={withTontine("/gestion/caisse", periodId)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sand)] hover:text-[var(--navy)]"
            >
              Tout voir <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="p-4">
            {stats.recentCash.length === 0 ? (
              <p className="rounded-xl bg-[var(--cream)]/50 px-4 py-8 text-center text-sm text-[var(--muted)]">
                Aucun mouvement enregistré.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {stats.recentCash.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[var(--line)] bg-[#FFFBF7] px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {e.type === "Entrée" ? (
                          <ArrowDownLeft
                            className="h-3.5 w-3.5 shrink-0 text-emerald-700"
                            strokeWidth={2}
                          />
                        ) : (
                          <ArrowUpRight
                            className="h-3.5 w-3.5 shrink-0 text-red-700"
                            strokeWidth={2}
                          />
                        )}
                        <p className="truncate text-sm font-medium text-[var(--navy)]">
                          {e.description}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
                        {formatDate(e.date)}
                        {e.memberName ? ` · ${e.memberName}` : ""}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        e.type === "Entrée" ? "text-emerald-800" : "text-red-800"
                      }`}
                    >
                      {e.type === "Entrée" ? "+" : "−"}
                      {formatFcfa(e.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <p className="text-sm font-semibold text-[var(--navy)]">
            Classement des cotisations
          </p>
          <p className="text-xs text-[var(--muted)]">
            {periodName}
            {stats.ranking.length > 0
              ? ` · ${stats.ranking.length} membre${
                  stats.ranking.length > 1 ? "s" : ""
                }`
              : ""}
          </p>
        </div>
        {stats.ranking.length === 0 ? (
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
                {stats.ranking.map((row, i) => (
                  <tr
                    key={row.memberId}
                    className="border-b border-[var(--line)] last:border-0 transition hover:bg-[#FFF8EB]/50"
                  >
                    <td className="px-5 py-3.5 text-[var(--muted)]">{i + 1}</td>
                    <td className="px-3 py-3.5 font-medium text-[var(--navy)]">
                      {row.memberName}
                    </td>
                    <td className="px-3 py-3.5 tabular-nums text-[var(--navy)]">
                      {formatFcfa(row.total)}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-[var(--navy)]">
                      {formatFcfa(row.loansOutstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
