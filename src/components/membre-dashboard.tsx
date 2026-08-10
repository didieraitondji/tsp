import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Handshake,
  PiggyBank,
  Receipt,
  Wallet,
} from "lucide-react";
import { contributionCountedAmount } from "@/lib/contribution-status";
import { todayIsoLocal } from "@/lib/cotisations-report";
import { loanRemaining, type MemberProgress } from "@/lib/db/domain";
import { formatDate, formatFcfa } from "@/lib/format";
import { resolveMembreSessionStatus } from "@/lib/membre-session-status";

function weekdayShort(isoDate: string): string {
  const labels = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."] as const;
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  return labels[new Date(y, m - 1, d).getDay()] ?? "";
}

export function MembreDashboard({
  progress,
  periodQuery,
}: {
  progress: MemberProgress;
  periodQuery: string;
}) {
  const today = todayIsoLocal();
  const weeks = [...(progress.weeks ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const byWeek = new Map(progress.contributions.map((c) => [c.weekId, c]));
  const nextIdx = weeks.findIndex((w) => w.date >= today);
  const next = nextIdx >= 0 ? weeks[nextIdx] : null;
  const nextContribution = next ? byWeek.get(next.id) : undefined;
  const nextPaid = contributionCountedAmount(nextContribution) > 0;
  const nextAmount = nextPaid
    ? contributionCountedAmount(nextContribution)
    : progress.weeklyTarget;

  const paidCount = progress.contributions.filter(
    (c) => contributionCountedAmount(c) > 0
  ).length;
  const pct =
    progress.weeksTotal > 0
      ? Math.round((paidCount / progress.weeksTotal) * 100)
      : 0;

  const pastWeeks = (nextIdx >= 0 ? weeks.slice(0, nextIdx) : weeks)
    .slice()
    .reverse();
  const unpaidPast = pastWeeks.filter(
    (w) => contributionCountedAmount(byWeek.get(w.id)) <= 0
  ).length;

  const recentPaid = [...progress.contributions]
    .filter((c) => contributionCountedAmount(c) > 0)
    .sort((a, b) => b.weekDate.localeCompare(a.weekDate))
    .slice(0, 4);

  const openLoans = progress.loans.filter((l) => l.status !== "Remboursé");
  const openPenalties = progress.penalties.filter((p) => !p.paid);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Progression + prochaine */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[0_1px_0_rgba(29,45,80,0.04)] md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Progression
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums text-[var(--navy)]">
                {paidCount}
                <span className="text-lg font-semibold text-[var(--muted)]">
                  {" "}
                  / {progress.weeksTotal}
                </span>
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                séances payées · {pct} %
              </p>
            </div>
            <Link
              href={`/membre/cotisations${periodQuery}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1D2D50] px-3.5 py-2 text-xs font-semibold text-[#FFCD79] transition hover:bg-[#152238]"
            >
              Voir mes séances
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>

          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[var(--cream)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1D2D50] to-[#D09C79] transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniMetric
              label="Total cotisé"
              value={formatFcfa(progress.totalContributed)}
              icon={PiggyBank}
            />
            <MiniMetric
              label="Solde net"
              value={formatFcfa(progress.netBalance)}
              icon={Wallet}
            />
            <MiniMetric
              label="Pénalités"
              value={formatFcfa(progress.penaltiesDue)}
              icon={Receipt}
              warn={progress.penaltiesDue > 0}
            />
            <MiniMetric
              label="Prêts dus"
              value={formatFcfa(progress.loansOutstanding)}
              icon={Handshake}
              warn={progress.loansOutstanding > 0}
            />
          </div>

          {unpaidPast > 0 ? (
            <p className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {unpaidPast} séance{unpaidPast > 1 ? "s" : ""} passée
              {unpaidPast > 1 ? "s" : ""} encore impayée
              {unpaidPast > 1 ? "s" : ""}.
            </p>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              Aucune séance passée en retard.
            </p>
          )}
        </section>

        <section
          className={`relative overflow-hidden rounded-3xl border p-5 md:p-6 ${
            next
              ? "border-[#1D2D50] bg-gradient-to-br from-[#1D2D50] via-[#243552] to-[#152238] text-[#F4E4D7] shadow-[0_18px_40px_-24px_rgba(21,34,56,0.65)]"
              : "border-[var(--line)] bg-white"
          }`}
        >
          {next ? (
            <>
              <div
                className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#FFCD79]/20 blur-2xl"
                aria-hidden
              />
              <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FFCD79]/90">
                Prochaine séance
              </p>
              <p className="relative mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F4E4D7]/55">
                {weekdayShort(next.date)}
              </p>
              <p className="relative mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums tracking-tight text-white">
                {formatDate(next.date)}
              </p>
              <div className="relative mt-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] text-[#F4E4D7]/65">
                    {nextPaid ? "Déjà réglée" : "Cible"}
                  </p>
                  <p className="mt-0.5 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-[#FFCD79]">
                    {nextAmount > 0 ? formatFcfa(nextAmount) : "—"}
                  </p>
                </div>
                <span className="inline-flex rounded-full bg-[#FFCD79]/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#FFCD79] ring-1 ring-inset ring-[#FFCD79]/35">
                  {nextPaid ? "Payé d’avance" : "À préparer"}
                </span>
              </div>
              <Link
                href={`/membre/cotisations${periodQuery}`}
                className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#FFCD79] transition hover:text-white"
              >
                Détail des séances
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
            </>
          ) : (
            <div className="flex h-full min-h-[12rem] flex-col items-start justify-center">
              <CalendarDays className="h-8 w-8 text-[var(--sand)]" strokeWidth={1.5} />
              <p className="mt-3 font-semibold text-[var(--navy)]">Saison terminée</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Plus aucune séance à venir sur cette tontine.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Derniers versements */}
      <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_1px_0_rgba(29,45,80,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
              Derniers versements
            </h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Cotisations validées récemment
            </p>
          </div>
          <Link
            href={`/membre/cotisations${periodQuery}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sand)] hover:text-[var(--navy)]"
          >
            Tout voir <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="p-4 md:p-5">
          {recentPaid.length === 0 ? (
            <p className="rounded-xl bg-[var(--cream)]/50 px-4 py-8 text-center text-sm text-[var(--muted)]">
              Aucun versement validé pour le moment.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentPaid.map((c) => {
                const status = resolveMembreSessionStatus(
                  c.weekDate,
                  true,
                  today
                );
                const label =
                  status === "paye_avance" ? "Payé d’avance" : "Validé";
                return (
                  <article
                    key={c.id}
                    className="rounded-2xl border border-[var(--line)] bg-gradient-to-br from-white to-[var(--cream)]/40 p-4"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      {weekdayShort(c.weekDate)}
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-bold tabular-nums text-[var(--navy)]">
                      {formatDate(c.weekDate)}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <p className="font-semibold tabular-nums text-[var(--navy)]">
                        {formatFcfa(contributionCountedAmount(c))}
                      </p>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200">
                        {label}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Prêts & pénalités */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SidePanel
          title="Prêts"
          description={
            openLoans.length === 0
              ? "Aucun prêt ouvert"
              : `${openLoans.length} ouvert${openLoans.length > 1 ? "s" : ""}`
          }
          href={`/membre/prets${periodQuery}`}
          empty={openLoans.length === 0}
          emptyText="Vous n’avez pas de prêt en cours sur cette tontine."
        >
          <ul className="space-y-2.5">
            {openLoans.slice(0, 3).map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[#FFFBF7] px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-[var(--muted)]">{l.id}</p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--navy)]">
                    {l.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    Reste
                  </p>
                  <p className="font-semibold tabular-nums text-[var(--navy)]">
                    {formatFcfa(loanRemaining(l))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </SidePanel>

        <SidePanel
          title="Pénalités"
          description={
            openPenalties.length === 0
              ? "Rien à régler"
              : `${formatFcfa(progress.penaltiesDue)} dus`
          }
          href={`/membre/penalites${periodQuery}`}
          empty={openPenalties.length === 0}
          emptyText="Aucune pénalité ouverte. Continuez comme ça."
        >
          <ul className="space-y-2.5">
            {openPenalties.slice(0, 3).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/70 bg-amber-50/50 px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--navy)]">
                    {p.motifLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {formatDate(p.date)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums text-amber-950">
                  {formatFcfa(p.amount)}
                </p>
              </li>
            ))}
          </ul>
        </SidePanel>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  icon: Icon,
  warn,
}: {
  label: string;
  value: string;
  icon: typeof PiggyBank;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 ${
        warn
          ? "border-amber-200/80 bg-amber-50/60"
          : "border-[var(--line)] bg-[var(--cream)]/35"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[var(--muted)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1.5 truncate font-[family-name:var(--font-display)] text-base font-bold tabular-nums text-[var(--navy)] sm:text-lg">
        {value}
      </p>
    </div>
  );
}

function SidePanel({
  title,
  description,
  href,
  empty,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  href: string;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_1px_0_rgba(29,45,80,0.04)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{description}</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sand)] hover:text-[var(--navy)]"
        >
          Tout voir <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="p-4 md:p-5">
        {empty ? (
          <p className="rounded-xl bg-[var(--cream)]/50 px-4 py-8 text-center text-sm text-[var(--muted)]">
            {emptyText}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
