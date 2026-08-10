import { getDashboardStats } from "@/lib/db/domain";
import { listPeriods } from "@/lib/db/periods";
import { DashboardTontineFilter } from "@/components/dashboard-tontine-filter";
import { GestionDashboard } from "@/components/gestion-dashboard";

export default async function GestionDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tontine?: string }>;
}) {
  const sp = await searchParams;
  const periods = await listPeriods();
  const periodId = sp.tontine?.trim() || periods[0]?.id || "";
  const period = periods.find((p) => p.id === periodId) ?? null;

  const stats = await getDashboardStats(periodId || undefined);

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
            Vue d’ensemble
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Tableau de bord
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Caisse = journal réel (cotisations, prêts, remboursements, pénalités payées).
          </p>
        </div>
        {periods.length > 0 && (
          <DashboardTontineFilter
            periods={periods.map((p) => ({ id: p.id, name: p.name }))}
            value={periodId}
          />
        )}
      </div>

      {!period ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          Créez une tontine pour voir le tableau de bord.
        </p>
      ) : (
        <GestionDashboard
          periodId={period.id}
          periodName={period.name}
          stats={stats}
        />
      )}
    </div>
  );
}
