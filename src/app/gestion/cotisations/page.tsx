import { AddWeekModal } from "@/components/add-week-modal";
import {
  CotisationsBoards,
  type CotisationsTab,
} from "@/components/cotisations-boards";
import { CotisationsTontineFilter } from "@/components/cotisations-tontine-filter";
import { listEnrolledForPeriod } from "@/lib/db/collections";
import { DEFAULT_SETTINGS } from "@/lib/db/defaults";
import { listPeriods } from "@/lib/db/periods";
import { generateWeeks } from "@/lib/periodicity";
import {
  readCollectionForPeriodId,
  readObjectForPeriodId,
  writeCollectionForPeriod,
} from "@/lib/db/store";
import { canWriteGestion } from "@/lib/auth/permissions";
import { requireGestionAccess } from "@/lib/auth/session";
import type { Contribution, Settings, Week } from "@/lib/types";

function resolveTab(raw: string | undefined): CotisationsTab {
  return raw === "mois" ? "mois" : "seances";
}

export default async function CotisationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tontine?: string; tab?: string }>;
}) {
  const session = await requireGestionAccess();
  const canWrite = canWriteGestion(session.user.role);
  const sp = await searchParams;
  const periods = await listPeriods();
  const periodId = sp.tontine?.trim() || periods[0]?.id || "";
  const period = periods.find((p) => p.id === periodId) ?? null;
  const tab = resolveTab(sp.tab);

  let weeks: Week[] = [];
  let contributions: Contribution[] = [];
  let members: Awaited<ReturnType<typeof listEnrolledForPeriod>> = [];
  let settings: Settings = DEFAULT_SETTINGS;

  if (period) {
    weeks = await readCollectionForPeriodId<Week>(period.id, "weeks");
    if (weeks.length === 0 && period.periodicity) {
      weeks = generateWeeks(period.startDate, period.endDate, period.periodicity);
      await writeCollectionForPeriod(period, "weeks", weeks);
    }
    [contributions, members, settings] = await Promise.all([
      readCollectionForPeriodId<Contribution>(period.id, "contributions"),
      listEnrolledForPeriod(period.id),
      readObjectForPeriodId(period.id, "settings", DEFAULT_SETTINGS),
    ]);
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
            Marquez Payé (montant = cible) ou Impayé (pénalité automatique). Chaque marquage est
            verrouillé ; déverrouillez avec le mot de passe pour corriger.
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
              tab={tab}
            />
          )}
        </div>
      </div>

      {!period ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          Créez une tontine pour saisir les cotisations.
        </p>
      ) : (
        <CotisationsBoards
          periodId={period.id}
          periodName={period.name}
          periodicity={period.periodicity}
          members={members}
          weeks={weeks}
          contributions={contributions}
          penaltyAmount={settings.penaltyLateContribution}
          readOnly={!canWrite}
          initialTab={tab}
        />
      )}
    </div>
  );
}
