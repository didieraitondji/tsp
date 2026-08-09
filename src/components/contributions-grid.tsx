"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContributionCell } from "@/components/contribution-cell";
import { CopyWeekReportButton } from "@/components/copy-week-report-button";
import { EditWeeklyTargetButton } from "@/components/edit-weekly-target-button";
import {
  MemberIdentity,
  STICKY_EDGE,
  WeekColumnStats,
  formatMemberShortName,
} from "@/components/contributions-table-ui";
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

const MEMBER_COL_W = 12; // rem — avatar + nom
const TARGET_COL_W = 6.5;
const STICKY_LEFT_TARGET = MEMBER_COL_W;
const WEEKDAY_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."] as const;

/** Fonds opaques (évite le bleed-through sous sticky header/footer). */
const BG = {
  panel: "bg-[#fffaf5]",
  white: "bg-white",
  cream: "bg-[#f4e4d7]",
  creamSoft: "bg-[#faf6f1]",
  next: "bg-[#FFF8EB]",
  hover: "bg-[#FFE6A8]",
  nextHeader: "bg-[#1D2D50] text-[#FFCD79]",
} as const;

function weekdayShort(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const day = new Date(y, m - 1, d).getDay();
  return WEEKDAY_SHORT[day] ?? "";
}

export function ContributionsGrid({
  periodId,
  periodicity,
  members,
  weeks,
  contributions,
  penaltyAmount,
  readOnly = false,
  onContributionsChange,
  onMemberTargetChange,
}: {
  periodId: string;
  periodicity?: Periodicity | null;
  members: EnrolledMember[];
  weeks: Week[];
  contributions: Contribution[];
  penaltyAmount: number;
  readOnly?: boolean;
  onContributionsChange?: (next: Contribution[]) => void;
  onMemberTargetChange?: (memberId: string, weeklyTarget: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextColRef = useRef<HTMLTableCellElement>(null);
  const alignedForPeriodRef = useRef<string | null>(null);
  const today = todayIsoLocal();
  const [hoveredWeekId, setHoveredWeekId] = useState<string | null>(null);

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
        const updated =
          idx >= 0
            ? prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
            : [...prev, patch];
        onContributionsChange?.(updated);
        return updated;
      });
    },
    [onContributionsChange]
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

  // Aligne « Prochaine » une seule fois par tontine (pas à chaque marquage).
  useEffect(() => {
    if (!nextId) return;
    if (alignedForPeriodRef.current === periodId) return;
    let cancelled = false;

    const alignNextColumn = () => {
      const scroller = scrollRef.current;
      const nextCell = nextColRef.current;
      if (!scroller || !nextCell) return false;
      const stickyWidth = (MEMBER_COL_W + TARGET_COL_W) * 16;
      const scrollerRect = scroller.getBoundingClientRect();
      const cellRect = nextCell.getBoundingClientRect();
      const delta = cellRect.left - scrollerRect.left - stickyWidth;
      if (Math.abs(delta) < 1) return true;
      scroller.scrollLeft += delta;
      return true;
    };

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        if (alignNextColumn()) {
          alignedForPeriodRef.current = periodId;
        } else {
          window.setTimeout(() => {
            if (cancelled) return;
            if (alignNextColumn()) alignedForPeriodRef.current = periodId;
          }, 80);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
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

  function weekColTone(w: Week, weekIndex: number): string {
    if (w.id === nextId) return BG.next;
    if (hoveredWeekId === w.id) return BG.hover;
    if (weekIndex % 2 === 1) return BG.cream;
    return BG.white;
  }

  function headerColTone(w: Week, weekIndex: number): string {
    const isNext = w.id === nextId;
    const isPast = w.date < today;
    const isHovered = hoveredWeekId === w.id;
    if (isNext) return BG.nextHeader;
    if (isHovered) return `${BG.hover} text-[var(--navy)]`;
    if (isPast) {
      return weekIndex % 2 === 1
        ? `${BG.cream} text-[var(--muted)]`
        : `${BG.creamSoft} text-[var(--muted)]`;
    }
    return weekIndex % 2 === 1
      ? `${BG.cream} text-[var(--navy)]`
      : `${BG.white} text-[var(--navy)]`;
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-[min(70vh,calc(100dvh-14rem))] overflow-auto overscroll-contain"
    >
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            <th
              className={`sticky left-0 top-0 z-40 border-b border-r border-[var(--line)] ${BG.panel} px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] shadow-[0_1px_0_var(--line)] ${STICKY_EDGE}`}
              style={{ minWidth: `${MEMBER_COL_W}rem`, maxWidth: `${MEMBER_COL_W}rem` }}
            >
              Membre
            </th>
            <th
              className={`sticky top-0 z-40 border-b border-r border-[var(--line)] ${BG.panel} px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] shadow-[0_1px_0_var(--line)] ${STICKY_EDGE}`}
              style={{
                left: `${STICKY_LEFT_TARGET}rem`,
                minWidth: `${TARGET_COL_W}rem`,
                maxWidth: `${TARGET_COL_W}rem`,
              }}
            >
              Cible
            </th>
            {ordered.map((w, weekIndex) => {
              const isNext = w.id === nextId;
              let paid = 0;
              let unpaid = 0;
              for (const m of sortedMembers) {
                const st = resolveContributionStatus(map.get(`${m.id}:${w.id}`));
                if (st === "paid") paid += 1;
                else if (st === "unpaid") unpaid += 1;
              }
              return (
                <th
                  key={w.id}
                  ref={isNext ? nextColRef : undefined}
                  onMouseEnter={() => setHoveredWeekId(w.id)}
                  onMouseLeave={() => setHoveredWeekId(null)}
                  title={formatDate(w.date)}
                  className={`sticky top-0 z-30 border-b border-[var(--line)] px-2 py-2 text-center text-xs font-semibold whitespace-nowrap shadow-[0_1px_0_var(--line)] ${headerColTone(w, weekIndex)}`}
                  style={{ minWidth: "7.25rem" }}
                >
                  <span className="block text-[10px] font-medium uppercase tracking-wide opacity-80">
                    {weekdayShort(w.date)}
                  </span>
                  <span className="tabular-nums">{formatDate(w.date)}</span>
                  {isNext ? (
                    <span className="mt-1 inline-flex rounded-full bg-[#FFCD79]/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#FFCD79]">
                      Prochaine
                    </span>
                  ) : (
                    <WeekColumnStats
                      paid={paid}
                      unpaid={unpaid}
                      total={sortedMembers.length}
                    />
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
                className={`sticky left-0 z-20 border-b border-r border-[var(--line)] ${BG.panel} px-3 py-2 group-hover:bg-[#FFF8EB] ${STICKY_EDGE}`}
                style={{ minWidth: `${MEMBER_COL_W}rem`, maxWidth: `${MEMBER_COL_W}rem` }}
              >
                <MemberIdentity lastName={m.lastName} firstName={m.firstName} />
              </td>
              <td
                className={`sticky z-20 border-b border-r border-[var(--line)] ${BG.panel} px-2 py-2 text-xs tabular-nums text-[var(--muted)] group-hover:bg-[#FFF8EB] ${STICKY_EDGE}`}
                style={{
                  left: `${STICKY_LEFT_TARGET}rem`,
                  minWidth: `${TARGET_COL_W}rem`,
                  maxWidth: `${TARGET_COL_W}rem`,
                }}
              >
                <span className="font-medium text-[var(--navy)]">
                  {formatFcfa(m.weeklyTarget).replace(" FCFA", "")}
                </span>
                <span className="mt-0.5 block text-[9px] text-[var(--muted)]">FCFA</span>
                {!readOnly && (
                  <EditWeeklyTargetButton
                    compact
                    periodId={periodId}
                    memberId={m.id}
                    memberLabel={formatMemberShortName(m.lastName, m.firstName)}
                    currentTarget={m.weeklyTarget}
                    onUpdated={(weeklyTarget) =>
                      onMemberTargetChange?.(m.id, weeklyTarget)
                    }
                  />
                )}
              </td>
              {ordered.map((w, weekIndex) => {
                const c = map.get(`${m.id}:${w.id}`);
                const amount = c?.amount ?? 0;
                const status = resolveContributionStatus(c);
                const locked = Boolean(c && isContributionRecordLocked(c));
                return (
                  <td
                    key={w.id}
                    onMouseEnter={() => setHoveredWeekId(w.id)}
                    onMouseLeave={() => setHoveredWeekId(null)}
                    title={`${m.lastName} ${m.firstName} · ${formatDate(w.date)}`}
                    className={`border-b border-[var(--line)] px-2 py-1.5 ${weekColTone(w, weekIndex)}`}
                  >
                    {readOnly ? (
                      <div
                        className={`rounded-lg border px-1.5 py-1 text-center text-[11px] font-semibold tabular-nums ${
                          status === "paid"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : status === "unpaid"
                              ? "border-red-200 bg-red-50 text-red-800"
                              : "border-[var(--line)] bg-white text-[var(--muted)]"
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
                        weekDate={w.date}
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
              className={`sticky bottom-0 left-0 z-40 border-t border-r border-[var(--line)] ${BG.panel} px-3 py-3 text-xs font-semibold text-[var(--navy)] shadow-[0_-1px_0_var(--line)] ${STICKY_EDGE}`}
              style={{ minWidth: `${MEMBER_COL_W}rem` }}
            >
              Total / rapport
            </td>
            <td
              className={`sticky bottom-0 z-40 border-t border-r border-[var(--line)] ${BG.panel} shadow-[0_-1px_0_var(--line)] ${STICKY_EDGE}`}
              style={{ left: `${STICKY_LEFT_TARGET}rem`, minWidth: `${TARGET_COL_W}rem` }}
            />
            {ordered.map((w, weekIndex) => {
              const lines = sortedMembers.map((m) => ({
                lastName: m.lastName,
                firstName: m.firstName,
                amount: map.get(`${m.id}:${w.id}`)?.amount ?? 0,
              }));
              const total = lines.reduce((s, l) => s + (l.amount > 0 ? l.amount : 0), 0);
              const isPast = w.date < today;
              return (
                <td
                  key={w.id}
                  onMouseEnter={() => setHoveredWeekId(w.id)}
                  onMouseLeave={() => setHoveredWeekId(null)}
                  className={`sticky bottom-0 z-30 border-t border-[var(--line)] px-2 py-3 align-top shadow-[0_-1px_0_var(--line)] ${weekColTone(w, weekIndex)}`}
                >
                  <p className="mb-2 text-center text-[11px] font-semibold tabular-nums text-[var(--navy)]">
                    {formatFcfa(total)}
                  </p>
                  <div className="flex flex-col items-center gap-1.5">
                    <CopyWeekReportButton
                      weekDate={w.date}
                      periodicity={periodicity}
                      lines={lines}
                      afterLate={false}
                    />
                    {isPast && !readOnly && (
                      <CopyWeekReportButton
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
