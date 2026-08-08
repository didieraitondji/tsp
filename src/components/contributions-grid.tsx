"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContributionCell } from "@/components/contribution-cell";
import { CopyWeekReportButton } from "@/components/copy-week-report-button";
import { orderWeeksForGrid, todayIsoLocal } from "@/lib/cotisations-report";
import {
  isContributionRecordLocked,
  resolveContributionStatus,
} from "@/lib/contribution-status";
import { formatDate, formatFcfa } from "@/lib/format";
import type {
  Contribution,
  ContributionStatus,
  EnrolledMember,
  Periodicity,
  Week,
} from "@/lib/types";

const MEMBER_COL_W = 11; // rem
const TARGET_COL_W = 6.5;
const STICKY_LEFT_TARGET = MEMBER_COL_W; // rem offset for cible

export function ContributionsGrid({
  periodId,
  periodicity,
  members,
  weeks,
  contributions,
  penaltyAmount,
  readOnly = false,
}: {
  periodId: string;
  periodicity?: Periodicity | null;
  members: EnrolledMember[];
  weeks: Week[];
  contributions: Contribution[];
  penaltyAmount: number;
  readOnly?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextColRef = useRef<HTMLTableCellElement>(null);
  const scrolledForPeriod = useRef<string | null>(null);
  const today = todayIsoLocal();

  const { ordered, nextId } = useMemo(() => orderWeeksForGrid(weeks, today), [weeks, today]);

  const [localContributions, setLocalContributions] = useState(contributions);
  useEffect(() => {
    setLocalContributions(contributions);
  }, [contributions, periodId]);

  const map = useMemo(() => {
    const m = new Map<string, Contribution>();
    for (const c of localContributions) m.set(`${c.memberId}:${c.weekId}`, c);
    return m;
  }, [localContributions]);

  const handleCellSaved = useCallback(
    (
      memberId: string,
      weekId: string,
      next: { amount: number; locked: boolean; status: ContributionStatus }
    ) => {
      setLocalContributions((prev) => {
        const idx = prev.findIndex((c) => c.memberId === memberId && c.weekId === weekId);
        const patch: Contribution = {
          id: idx >= 0 ? prev[idx].id : `local-${memberId}-${weekId}`,
          memberId,
          weekId,
          amount: next.amount,
          paidAt: new Date().toISOString(),
          recordedBy: idx >= 0 ? prev[idx].recordedBy : "",
          locked: next.locked,
          status: next.status,
        };
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...prev[idx], ...patch };
          return copy;
        }
        return [...prev, patch];
      });
    },
    []
  );

  const sortedMembers = useMemo(
    () =>
      [...members]
        .filter((m) => m.status === "Actif")
        .sort(
          (a, b) =>
            a.lastName.localeCompare(b.lastName, "fr") ||
            a.firstName.localeCompare(b.firstName, "fr")
        ),
    [members]
  );

  useEffect(() => {
    if (scrolledForPeriod.current === periodId) return;
    const scroller = scrollRef.current;
    const nextCell = nextColRef.current;
    if (!scroller || !nextCell) return;
    const stickyWidth = (MEMBER_COL_W + TARGET_COL_W) * 16;
    scroller.scrollLeft = Math.max(0, nextCell.offsetLeft - stickyWidth);
    scrolledForPeriod.current = periodId;
  }, [ordered, nextId, periodId]);

  if (weeks.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
        Aucune séance générée pour cette tontine.
      </p>
    );
  }

  if (sortedMembers.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
        Aucun membre actif inscrit à cette tontine.
      </p>
    );
  }

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            <th
              className="sticky left-0 z-30 border-b border-r border-[var(--line)] bg-[var(--panel)] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
              style={{ minWidth: `${MEMBER_COL_W}rem`, maxWidth: `${MEMBER_COL_W}rem` }}
            >
              Membre
            </th>
            <th
              className="sticky z-30 border-b border-r border-[var(--line)] bg-[var(--panel)] px-2 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
              style={{
                left: `${STICKY_LEFT_TARGET}rem`,
                minWidth: `${TARGET_COL_W}rem`,
                maxWidth: `${TARGET_COL_W}rem`,
              }}
            >
              Cible
            </th>
            {ordered.map((w) => {
              const isNext = w.id === nextId;
              const isPast = w.date < today;
              return (
                <th
                  key={w.id}
                  ref={isNext ? nextColRef : undefined}
                  className={`border-b border-[var(--line)] px-2 py-3 text-center text-xs font-semibold whitespace-nowrap ${
                    isNext
                      ? "bg-[#1D2D50] text-[#FFCD79]"
                      : isPast
                        ? "bg-[var(--cream)]/80 text-[var(--muted)]"
                        : "bg-white text-[var(--navy)]"
                  }`}
                  style={{ minWidth: "7rem" }}
                >
                  {formatDate(w.date)}
                  {isNext && (
                    <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-wide opacity-80">
                      Prochaine
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedMembers.map((m) => (
            <tr key={m.id} className="group">
              <td
                className="sticky left-0 z-20 border-b border-r border-[var(--line)] bg-[var(--panel)] px-3 py-2 font-medium text-[var(--navy)] group-hover:bg-[#FFF8EB]"
                style={{ minWidth: `${MEMBER_COL_W}rem`, maxWidth: `${MEMBER_COL_W}rem` }}
              >
                <span className="block truncate">
                  {m.lastName} {m.firstName}
                </span>
              </td>
              <td
                className="sticky z-20 border-b border-r border-[var(--line)] bg-[var(--panel)] px-2 py-2 text-xs tabular-nums text-[var(--muted)] group-hover:bg-[#FFF8EB]"
                style={{
                  left: `${STICKY_LEFT_TARGET}rem`,
                  minWidth: `${TARGET_COL_W}rem`,
                  maxWidth: `${TARGET_COL_W}rem`,
                }}
              >
                {formatFcfa(m.weeklyTarget)}
              </td>
              {ordered.map((w) => {
                const c = map.get(`${m.id}:${w.id}`);
                const amount = c?.amount ?? 0;
                const status = resolveContributionStatus(c);
                const locked = Boolean(c && isContributionRecordLocked(c));
                const isNext = w.id === nextId;
                return (
                  <td
                    key={w.id}
                    className={`border-b border-[var(--line)] px-2 py-1.5 ${
                      isNext ? "bg-[#FFF8EB]/70" : ""
                    }`}
                  >
                    {readOnly ? (
                      <div
                        className={`rounded-lg border px-1.5 py-1 text-center text-[11px] font-semibold tabular-nums ${
                          status === "paid"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : status === "unpaid"
                              ? "border-red-200 bg-red-50 text-red-800"
                              : "border-[var(--line)] bg-[var(--cream)]/40 text-[var(--muted)]"
                        }`}
                      >
                        {status === "paid"
                          ? formatFcfa(amount).replace(" FCFA", "")
                          : status === "unpaid"
                            ? "Impayé"
                            : "—"}
                      </div>
                    ) : (
                      <ContributionCell
                        periodId={periodId}
                        memberId={m.id}
                        weekId={w.id}
                        weeklyTarget={m.weeklyTarget}
                        penaltyAmount={penaltyAmount}
                        amount={amount}
                        status={status}
                        locked={locked}
                        onSaved={(next) => handleCellSaved(m.id, w.id, next)}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td
              className="sticky left-0 z-20 border-t border-r border-[var(--line)] bg-[var(--panel)] px-3 py-3 text-xs font-semibold text-[var(--navy)]"
              style={{ minWidth: `${MEMBER_COL_W}rem` }}
            >
              Total / rapport
            </td>
            <td
              className="sticky z-20 border-t border-r border-[var(--line)] bg-[var(--panel)]"
              style={{ left: `${STICKY_LEFT_TARGET}rem`, minWidth: `${TARGET_COL_W}rem` }}
            />
            {ordered.map((w) => {
              const lines = sortedMembers.map((m) => ({
                lastName: m.lastName,
                firstName: m.firstName,
                amount: map.get(`${m.id}:${w.id}`)?.amount ?? 0,
              }));
              const total = lines.reduce((s, l) => s + (l.amount > 0 ? l.amount : 0), 0);
              const isPast = w.date < today;
              return (
                <td key={w.id} className="border-t border-[var(--line)] px-2 py-3 align-top">
                  <p className="mb-2 text-center text-[11px] font-semibold tabular-nums text-[var(--navy)]">
                    {formatFcfa(total)}
                  </p>
                  <div className="flex flex-col items-center gap-1.5">
                    <CopyWeekReportButton
                      periodId={periodId}
                      weekId={w.id}
                      weekDate={w.date}
                      periodicity={periodicity}
                      lines={lines}
                      afterLate={false}
                    />
                    {isPast && !readOnly && (
                      <CopyWeekReportButton
                        periodId={periodId}
                        weekId={w.id}
                        weekDate={w.date}
                        periodicity={periodicity}
                        lines={lines}
                        afterLate
                      />
                    )}
                  </div>
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
