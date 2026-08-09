"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CalendarRange } from "lucide-react";
import { ContributionsGrid } from "@/components/contributions-grid";
import { ContributionsMonthlyGrid } from "@/components/contributions-monthly-grid";
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

  useEffect(() => {
    setContributions(initialContributions);
  }, [initialContributions, periodId]);

  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers, periodId]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, periodId]);

  const actifs = members.filter((m) => m.status === "Actif").length;

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
            </span>
          </p>
        </div>
        {tab === "mois" && (
          <p className="text-xs text-[var(--muted)]">
            Somme des cotisations payées, mois par mois
          </p>
        )}
      </div>

      {tab === "seances" ? (
        <ContributionsGrid
          key={`seances-${periodId}`}
          periodId={periodId}
          periodicity={periodicity}
          members={members}
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
          weeks={weeks}
          contributions={contributions}
        />
      )}
    </section>
  );
}
