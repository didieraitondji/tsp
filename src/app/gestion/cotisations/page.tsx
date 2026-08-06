import { AddWeekModal } from "@/components/add-week-modal";
import { CotisationsTontineFilter } from "@/components/cotisations-tontine-filter";
import { ContributionsGrid } from "@/components/contributions-grid";
import { listEnrolledForPeriod } from "@/lib/db/collections";
import { listPeriods } from "@/lib/db/periods";
import { generateWeeks } from "@/lib/periodicity";
import {
  readCollectionForPeriodId,
  writeCollectionForPeriod,
} from "@/lib/db/store";
import { canWriteGestion } from "@/lib/auth/permissions";
import { requireGestionAccess } from "@/lib/auth/session";
import type { Contribution, Week } from "@/lib/types";

export default async function CotisationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tontine?: string }>;
}) {
  const session = await requireGestionAccess();
  const canWrite = canWriteGestion(session.user.role);
  const sp = await searchParams;
  const periods = await listPeriods();
  const periodId = sp.tontine?.trim() || periods[0]?.id || "";
  const period = periods.find((p) => p.id === periodId) ?? null;

  let weeks: Week[] = [];
  let contributions: Contribution[] = [];
  let members: Awaited<ReturnType<typeof listEnrolledForPeriod>> = [];

  if (period) {
    weeks = await readCollectionForPeriodId<Week>(period.id, "weeks");
    if (weeks.length === 0 && period.periodicity) {
      weeks = generateWeeks(period.startDate, period.endDate, period.periodicity);
      await writeCollectionForPeriod(period, "weeks", weeks);
    }
    contributions = await readCollectionForPeriodId<Contribution>(period.id, "contributions");
    members = await listEnrolledForPeriod(period.id);
  }

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
            Opérations
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Cotisations
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Grille membre × séances. Les dates viennent de la périodicité de la tontine. Une
            cotisation saisie est verrouillée.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && period && (
            <AddWeekModal periodId={period.id} tontineName={period.name} />
          )}
          {periods.length > 0 && (
            <CotisationsTontineFilter
              periods={periods.map((p) => ({ id: p.id, name: p.name }))}
              value={periodId}
            />
          )}
        </div>
      </div>

      {!period ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          Créez une tontine pour saisir les cotisations.
        </p>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3">
            <p className="text-sm font-medium text-[var(--navy)]">
              {period.name}
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                {weeks.length} séance{weeks.length === 1 ? "" : "s"} ·{" "}
                {members.filter((m) => m.status === "Actif").length} actifs
              </span>
            </p>
          </div>
          <ContributionsGrid
            periodId={period.id}
            periodicity={period.periodicity}
            members={members}
            weeks={weeks}
            contributions={contributions}
            readOnly={!canWrite}
          />
        </section>
      )}
    </div>
  );
}
