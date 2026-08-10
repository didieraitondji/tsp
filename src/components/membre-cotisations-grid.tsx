"use client";

import { useState, type ReactNode } from "react";
import { CalendarCheck2, CalendarClock, CalendarX2, Sparkles } from "lucide-react";
import { contributionCountedAmount } from "@/lib/contribution-status";
import { todayIsoLocal } from "@/lib/cotisations-report";
import { formatDate, formatFcfa } from "@/lib/format";
import {
  resolveMembreSessionStatus,
  type MembreSessionStatus,
} from "@/lib/membre-session-status";
import type { Contribution, Week } from "@/lib/types";

export type { MembreSessionStatus };
export { resolveMembreSessionStatus };

type HistoryTab = "passees" | "avenir";

const STATUS_UI: Record<
  MembreSessionStatus,
  {
    label: string;
    tag: string;
    icon: typeof CalendarCheck2;
    card: string;
  }
> = {
  valide: {
    label: "Validé",
    tag: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    icon: CalendarCheck2,
    card: "border-[var(--line)] bg-white",
  },
  paye_avance: {
    label: "Payé d’avance",
    tag: "bg-sky-50 text-sky-900 ring-sky-200",
    icon: Sparkles,
    card: "border-sky-200/80 bg-gradient-to-br from-white to-sky-50/60",
  },
  impaye: {
    label: "Impayé",
    tag: "bg-amber-50 text-amber-950 ring-amber-200",
    icon: CalendarX2,
    card: "border-amber-200/70 bg-gradient-to-br from-white to-amber-50/50",
  },
  a_venir: {
    label: "À venir",
    tag: "bg-[var(--cream)] text-[var(--navy)] ring-[var(--line)]",
    icon: CalendarClock,
    card: "border-[var(--line)] bg-[#FFFBF7]",
  },
};

function weekdayShort(isoDate: string): string {
  const labels = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."] as const;
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  return labels[new Date(y, m - 1, d).getDay()] ?? "";
}

function SessionCard({
  week,
  contribution,
  weeklyTarget,
  today,
  featured,
}: {
  week: Week;
  contribution?: Contribution;
  weeklyTarget: number;
  today: string;
  featured?: boolean;
}) {
  const amount = contributionCountedAmount(contribution);
  const paid = amount > 0;
  const status = resolveMembreSessionStatus(week.date, paid, today);
  const ui = STATUS_UI[status];
  const Icon = ui.icon;
  const displayAmount = paid ? amount : weeklyTarget;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-4 transition duration-200 ${
        featured
          ? "border-[#1D2D50] bg-gradient-to-br from-[#1D2D50] via-[#243552] to-[#152238] text-[#F4E4D7] shadow-[0_18px_40px_-24px_rgba(21,34,56,0.65)]"
          : `${ui.card} shadow-[0_1px_0_rgba(29,45,80,0.04)] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-20px_rgba(29,45,80,0.28)]`
      }`}
    >
      {featured ? (
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#FFCD79]/20 blur-2xl"
          aria-hidden
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
              featured ? "text-[#FFCD79]/90" : "text-[var(--muted)]"
            }`}
          >
            {weekdayShort(week.date)}
          </p>
          <p
            className={`mt-1 font-[family-name:var(--font-display)] text-lg font-bold tabular-nums tracking-tight ${
              featured ? "text-white" : "text-[var(--navy)]"
            }`}
          >
            {formatDate(week.date)}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
            featured
              ? "bg-[#FFCD79]/20 text-[#FFCD79] ring-[#FFCD79]/35"
              : ui.tag
          }`}
        >
          <Icon className="h-3 w-3" strokeWidth={2} />
          {featured && !paid ? "Prochaine" : ui.label}
        </span>
      </div>

      <div className="relative mt-5">
        <p
          className={`text-[11px] font-medium ${
            featured ? "text-[#F4E4D7]/65" : "text-[var(--muted)]"
          }`}
        >
          {paid ? "Montant versé" : "Cible"}
        </p>
        <p
          className={`mt-0.5 font-[family-name:var(--font-display)] text-xl font-bold tabular-nums ${
            featured ? "text-[#FFCD79]" : "text-[var(--navy)]"
          }`}
        >
          {displayAmount > 0 ? formatFcfa(displayAmount) : "—"}
        </p>
      </div>

      {featured ? (
        <p className="relative mt-3 text-[11px] leading-relaxed text-[#F4E4D7]/70">
          {paid
            ? "Séance à venir — déjà réglée."
            : "Prochaine échéance de cotisation."}
        </p>
      ) : null}
    </article>
  );
}

function CardsGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

export function MembreCotisationsGrid({
  weeks,
  contributions,
  weeklyTarget,
}: {
  weeks: Week[];
  contributions: Contribution[];
  weeklyTarget: number;
}) {
  const [tab, setTab] = useState<HistoryTab>("passees");
  const today = todayIsoLocal();
  const byWeek = new Map(contributions.map((c) => [c.weekId, c]));
  const sorted = [...weeks].sort((a, b) => a.date.localeCompare(b.date));
  const nextIdx = sorted.findIndex((w) => w.date >= today);
  const next = nextIdx >= 0 ? sorted[nextIdx] : null;
  const futures = nextIdx >= 0 ? sorted.slice(nextIdx + 1) : [];
  const pasts = (nextIdx >= 0 ? sorted.slice(0, nextIdx) : sorted).slice().reverse();

  if (sorted.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-[var(--muted)]">
        Aucune séance planifiée pour cette tontine.
      </p>
    );
  }

  const list = tab === "passees" ? pasts : futures;

  return (
    <div className="space-y-6">
      {next ? (
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Prochaine séance
          </h3>
          <div className="max-w-md">
            <SessionCard
              week={next}
              contribution={byWeek.get(next.id)}
              weeklyTarget={weeklyTarget}
              today={today}
              featured
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-xl bg-[var(--cream)]/60 p-1">
            <button
              type="button"
              onClick={() => setTab("passees")}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tab === "passees"
                  ? "bg-[#1D2D50] text-[#FFCD79]"
                  : "text-[var(--muted)] hover:text-[var(--navy)]"
              }`}
            >
              Séances passées
              <span
                className={`ml-1.5 text-[11px] font-medium ${
                  tab === "passees" ? "text-[#FFCD79]/80" : "text-[var(--muted)]"
                }`}
              >
                {pasts.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("avenir")}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tab === "avenir"
                  ? "bg-[#1D2D50] text-[#FFCD79]"
                  : "text-[var(--muted)] hover:text-[var(--navy)]"
              }`}
            >
              À venir
              <span
                className={`ml-1.5 text-[11px] font-medium ${
                  tab === "avenir" ? "text-[#FFCD79]/80" : "text-[var(--muted)]"
                }`}
              >
                {futures.length}
              </span>
            </button>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="rounded-xl bg-[var(--cream)]/40 px-4 py-8 text-center text-sm text-[var(--muted)]">
            {tab === "passees"
              ? "Aucune séance passée pour le moment."
              : "Aucune autre séance à venir."}
          </p>
        ) : (
          <CardsGrid>
            {list.map((w) => (
              <SessionCard
                key={w.id}
                week={w}
                contribution={byWeek.get(w.id)}
                weeklyTarget={weeklyTarget}
                today={today}
              />
            ))}
          </CardsGrid>
        )}
      </div>
    </div>
  );
}
