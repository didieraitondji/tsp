"use client";

import { useEffect, useState } from "react";
import { ContributionsGrid } from "@/components/contributions-grid";
import { ContributionsMonthlyGrid } from "@/components/contributions-monthly-grid";
import type { Contribution, EnrolledMember, Periodicity, Week } from "@/lib/types";

export function CotisationsBoards({
  periodId,
  periodName,
  periodicity,
  members,
  weeks,
  contributions: initialContributions,
  penaltyAmount,
  readOnly,
}: {
  periodId: string;
  periodName: string;
  periodicity?: Periodicity | null;
  members: EnrolledMember[];
  weeks: Week[];
  contributions: Contribution[];
  penaltyAmount: number;
  readOnly: boolean;
}) {
  const [contributions, setContributions] = useState(initialContributions);

  useEffect(() => {
    setContributions(initialContributions);
  }, [initialContributions, periodId]);

  const actifs = members.filter((m) => m.status === "Actif").length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3">
          <p className="text-sm font-medium text-[var(--navy)]">
            {periodName}
            <span className="ml-2 text-xs font-normal text-[var(--muted)]">
              {weeks.length} séance{weeks.length === 1 ? "" : "s"} · {actifs} actifs
            </span>
          </p>
        </div>
        <ContributionsGrid
          periodId={periodId}
          periodicity={periodicity}
          members={members}
          weeks={weeks}
          contributions={contributions}
          penaltyAmount={penaltyAmount}
          readOnly={readOnly}
          onContributionsChange={setContributions}
        />
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-5 py-3">
          <p className="text-sm font-medium text-[var(--navy)]">Totaux par mois</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Somme des cotisations payées de chaque membre, mois par mois.
          </p>
        </div>
        <ContributionsMonthlyGrid
          members={members}
          weeks={weeks}
          contributions={contributions}
        />
      </section>
    </div>
  );
}
