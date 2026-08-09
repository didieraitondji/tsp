"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildMonthlyTotals, todayIsoLocal } from "@/lib/cotisations-report";
import { formatFcfa } from "@/lib/format";
import type { Contribution, EnrolledMember, Week } from "@/lib/types";

const MEMBER_COL_W = 11; // rem
const BG = {
  panel: "bg-[#fffaf5]",
  white: "bg-white",
  cream: "bg-[#f4e4d7]",
  creamSoft: "bg-[#faf6f1]",
  current: "bg-[#FFF8EB]",
  hover: "bg-[#FFE6A8]",
  currentHeader: "bg-[#1D2D50] text-[#FFCD79]",
} as const;

function currentMonthKey(todayIso: string): string {
  return todayIso.slice(0, 7);
}

export function ContributionsMonthlyGrid({
  members,
  weeks,
  contributions,
}: {
  members: EnrolledMember[];
  weeks: Week[];
  contributions: Contribution[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentColRef = useRef<HTMLTableCellElement>(null);
  const today = todayIsoLocal();
  const currentKey = currentMonthKey(today);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

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

  const { months, amounts, monthTotals } = useMemo(
    () =>
      buildMonthlyTotals(
        weeks,
        contributions,
        sortedMembers.map((m) => m.id)
      ),
    [weeks, contributions, sortedMembers]
  );

  useEffect(() => {
    const scroller = scrollRef.current;
    const col = currentColRef.current;
    if (!scroller || !col) return;
    const stickyWidth = MEMBER_COL_W * 16;
    const scrollerRect = scroller.getBoundingClientRect();
    const cellRect = col.getBoundingClientRect();
    const delta = cellRect.left - scrollerRect.left - stickyWidth;
    if (Math.abs(delta) >= 1) scroller.scrollLeft += delta;
  }, [months, currentKey]);

  if (weeks.length === 0 || sortedMembers.length === 0 || months.length === 0) {
    return null;
  }

  function colTone(monthKey: string, index: number): string {
    if (monthKey === currentKey) return BG.current;
    if (hoveredMonth === monthKey) return BG.hover;
    if (index % 2 === 1) return BG.cream;
    return BG.white;
  }

  function headerTone(monthKey: string, index: number): string {
    if (monthKey === currentKey) return BG.currentHeader;
    if (hoveredMonth === monthKey) return `${BG.hover} text-[var(--navy)]`;
    return index % 2 === 1
      ? `${BG.cream} text-[var(--navy)]`
      : `${BG.creamSoft} text-[var(--navy)]`;
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-[min(50vh,calc(100dvh-16rem))] overflow-auto overscroll-contain"
    >
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            <th
              className={`sticky left-0 top-0 z-40 border-b border-r border-[var(--line)] ${BG.panel} px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] shadow-[0_1px_0_var(--line)]`}
              style={{ minWidth: `${MEMBER_COL_W}rem`, maxWidth: `${MEMBER_COL_W}rem` }}
            >
              Membre
            </th>
            {months.map((mo, i) => {
              const isCurrent = mo.key === currentKey;
              return (
                <th
                  key={mo.key}
                  ref={isCurrent ? currentColRef : undefined}
                  onMouseEnter={() => setHoveredMonth(mo.key)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  className={`sticky top-0 z-30 border-b border-[var(--line)] px-2 py-2 text-center text-xs font-semibold whitespace-nowrap shadow-[0_1px_0_var(--line)] ${headerTone(mo.key, i)}`}
                  style={{ minWidth: "7.5rem" }}
                >
                  <span className="block capitalize">{mo.label}</span>
                  {isCurrent && (
                    <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-wide opacity-80">
                      Mois en cours
                    </span>
                  )}
                </th>
              );
            })}
            <th
              className={`sticky top-0 z-30 border-b border-l border-[var(--line)] ${BG.panel} px-2 py-2 text-center text-xs font-semibold text-[var(--navy)] shadow-[0_1px_0_var(--line)]`}
              style={{ minWidth: "7rem" }}
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedMembers.map((m) => {
            const row = amounts.get(m.id);
            const memberTotal = months.reduce(
              (s, mo) => s + (row?.get(mo.key) ?? 0),
              0
            );
            return (
              <tr key={m.id} className="group">
                <td
                  className={`sticky left-0 z-20 border-b border-r border-[var(--line)] ${BG.panel} px-3 py-2 font-medium text-[var(--navy)] group-hover:bg-[#FFF8EB]`}
                  style={{ minWidth: `${MEMBER_COL_W}rem`, maxWidth: `${MEMBER_COL_W}rem` }}
                >
                  <span className="block truncate">
                    {m.lastName} {m.firstName}
                  </span>
                </td>
                {months.map((mo, i) => {
                  const amount = row?.get(mo.key) ?? 0;
                  return (
                    <td
                      key={mo.key}
                      onMouseEnter={() => setHoveredMonth(mo.key)}
                      onMouseLeave={() => setHoveredMonth(null)}
                      className={`border-b border-[var(--line)] px-2 py-2 text-center text-xs tabular-nums ${colTone(mo.key, i)} ${
                        amount > 0 ? "font-semibold text-[var(--navy)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {amount > 0 ? formatFcfa(amount).replace(" FCFA", "") : "—"}
                    </td>
                  );
                })}
                <td
                  className={`border-b border-l border-[var(--line)] ${BG.panel} px-2 py-2 text-center text-xs font-semibold tabular-nums text-[var(--navy)]`}
                >
                  {memberTotal > 0 ? formatFcfa(memberTotal).replace(" FCFA", "") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td
              className={`sticky bottom-0 left-0 z-40 border-t border-r border-[var(--line)] ${BG.panel} px-3 py-3 text-xs font-semibold text-[var(--navy)] shadow-[0_-1px_0_var(--line)]`}
              style={{ minWidth: `${MEMBER_COL_W}rem` }}
            >
              Total mois
            </td>
            {months.map((mo, i) => {
              const total = monthTotals.get(mo.key) ?? 0;
              return (
                <td
                  key={mo.key}
                  onMouseEnter={() => setHoveredMonth(mo.key)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  className={`sticky bottom-0 z-30 border-t border-[var(--line)] px-2 py-3 text-center text-[11px] font-semibold tabular-nums text-[var(--navy)] shadow-[0_-1px_0_var(--line)] ${colTone(mo.key, i)}`}
                >
                  {formatFcfa(total)}
                </td>
              );
            })}
            <td
              className={`sticky bottom-0 z-30 border-t border-l border-[var(--line)] ${BG.panel} px-2 py-3 text-center text-[11px] font-semibold tabular-nums text-[var(--navy)] shadow-[0_-1px_0_var(--line)]`}
            >
              {formatFcfa(
                months.reduce((s, mo) => s + (monthTotals.get(mo.key) ?? 0), 0)
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
