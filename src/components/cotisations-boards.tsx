"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CalendarRange, Search, X } from "lucide-react";
import { ContributionsGrid } from "@/components/contributions-grid";
import { ContributionsMonthlyGrid } from "@/components/contributions-monthly-grid";
import { normalizeSearch } from "@/lib/search";
import type { Contribution, EnrolledMember, Periodicity, Week } from "@/lib/types";

export type CotisationsTab = "seances" | "mois";

export function CotisationsBoards({
  periodId,
  periodName,
  periodicity,
  members: initialMembers,
  weeks,
  contributions: initialContributions,
  penaltyAmount,
  requirePasswordToUnlock = true,
  readOnly,
  initialTab = "seances",
}: {
  periodId: string;
  periodName: string;
  periodicity?: Periodicity | null;
  members: EnrolledMember[];
  weeks: Week[];
  contributions: Contribution[];
  penaltyAmount: number;
  requirePasswordToUnlock?: boolean;
  readOnly: boolean;
  initialTab?: CotisationsTab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<CotisationsTab>(initialTab);
  const [contributions, setContributions] = useState(initialContributions);
  const [members, setMembers] = useState(initialMembers);
  const [memberQuery, setMemberQuery] = useState("");

  // Ne pas réécraser les totaux / verrous locaux à chaque refresh RSC.
  useEffect(() => {
    setContributions(initialContributions);
    setMembers(initialMembers);
    setTab(initialTab);
    setMemberQuery("");
  }, [periodId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when tontine changes

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const actifs = members.filter((m) => m.status === "Actif").length;
  const memberNeedle = memberQuery.trim() ? normalizeSearch(memberQuery) : "";

  const visibleMembers = useMemo(() => {
    if (!memberNeedle) return members;
    return members.filter((m) => {
      const hay = normalizeSearch(
        [m.lastName, m.firstName, m.phone, m.id].filter(Boolean).join(" ")
      );
      return hay.includes(memberNeedle);
    });
  }, [members, memberNeedle]);

  const visibleActifsCount = visibleMembers.filter((m) => m.status === "Actif").length;
  const visibleMemberIds = useMemo(
    () => (memberNeedle ? new Set(visibleMembers.map((m) => m.id)) : null),
    [memberNeedle, visibleMembers]
  );

  const selectTab = (next: CotisationsTab) => {
    setTab(next);
    const params = new URLSearchParams();
    if (periodId) params.set("tontine", periodId);
    if (next !== "seances") params.set("tab", next);
    router.replace(`/gestion/cotisations?${params.toString()}`, { scroll: false });
  };

  const handleTargetChange = (memberId: string, weeklyTarget: number) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, weeklyTarget } : m))
    );
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-[var(--cream)]/60 p-1">
            <button
              type="button"
              onClick={() => selectTab("seances")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tab === "seances"
                  ? "bg-[#1D2D50] text-[#FFCD79]"
                  : "text-[var(--muted)] hover:text-[var(--navy)]"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
              Par séance
            </button>
            <button
              type="button"
              onClick={() => selectTab("mois")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tab === "mois"
                  ? "bg-[#1D2D50] text-[#FFCD79]"
                  : "text-[var(--muted)] hover:text-[var(--navy)]"
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.75} />
              Totaux par mois
            </button>
          </div>
          <p className="text-sm font-medium text-[var(--navy)]">
            {periodName}
            <span className="ml-2 text-xs font-normal text-[var(--muted)]">
              {weeks.length} séance{weeks.length === 1 ? "" : "s"} · {actifs} actifs
              {memberNeedle
                ? ` · ${visibleActifsCount} affiché${visibleActifsCount === 1 ? "" : "s"}`
                : ""}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block min-w-[12rem] sm:w-[16rem]">
            <span className="sr-only">Rechercher un membre</span>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]"
              strokeWidth={1.75}
            />
            <input
              type="search"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Rechercher un membre…"
              className="w-full rounded-lg border border-[var(--line)] bg-white py-1.5 pl-8 pr-8 text-sm text-[var(--navy)] outline-none ring-[var(--brand)] placeholder:text-[var(--muted)] focus:ring-2"
            />
            {memberQuery ? (
              <button
                type="button"
                onClick={() => setMemberQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--muted)] transition hover:bg-[var(--cream)] hover:text-[var(--navy)]"
                aria-label="Effacer la recherche"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            ) : null}
          </label>
          {tab === "mois" && (
            <p className="text-xs text-[var(--muted)]">
              Somme des cotisations payées, mois par mois
            </p>
          )}
        </div>
      </div>

      {tab === "seances" ? (
        <ContributionsGrid
          key={`seances-${periodId}`}
          periodId={periodId}
          periodicity={periodicity}
          members={members}
          visibleMemberIds={visibleMemberIds}
          weeks={weeks}
          contributions={contributions}
          penaltyAmount={penaltyAmount}
          requirePasswordToUnlock={requirePasswordToUnlock}
          readOnly={readOnly}
          onContributionsChange={setContributions}
          onMemberTargetChange={handleTargetChange}
        />
      ) : (
        <ContributionsMonthlyGrid
          key={`mois-${periodId}`}
          members={members}
          visibleMemberIds={visibleMemberIds}
          weeks={weeks}
          contributions={contributions}
        />
      )}
    </section>
  );
}
