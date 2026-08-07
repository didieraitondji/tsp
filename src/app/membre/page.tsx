import Link from "next/link";
import {
  ArrowRight,
  Handshake,
  PiggyBank,
  Receipt,
  Scale,
  Wallet,
} from "lucide-react";
import { formatDate, formatFcfa } from "@/lib/format";
import { loadMembreContext } from "@/lib/membre-page";
import {
  MembreAlert,
  MembreEmpty,
  MembreHero,
  MembrePanel,
  MembreStatCard,
} from "@/components/membre-ui";

export default async function MembreOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ tontine?: string }>;
}) {
  const sp = (await searchParams) || {};
  const ctx = await loadMembreContext(sp.tontine);

  if (!ctx.memberId) {
    return (
      <div className="space-y-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--navy)]">
          Ma progression
        </h1>
        <MembreAlert tone="error">
          Aucun membre n’est lié à ce compte. Contactez le bureau pour associer votre fiche.
        </MembreAlert>
      </div>
    );
  }

  if (!ctx.progress) {
    return (
      <div className="space-y-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--navy)]">
          Ma progression
        </h1>
        <MembreAlert tone="error">
          Fiche membre introuvable dans l’annuaire. Contactez le bureau.
        </MembreAlert>
      </div>
    );
  }

  const { progress, periodId } = ctx;
  const q = periodId ? `?tontine=${encodeURIComponent(periodId)}` : "";
  const pct =
    progress.weeksTotal > 0
      ? Math.round((progress.weeksPaid / progress.weeksTotal) * 100)
      : 0;

  const recentContributions = [...progress.contributions]
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .slice(0, 4);
  const openLoans = progress.loans.filter((l) => l.status !== "Remboursé").slice(0, 3);
  const openPenalties = progress.penalties.filter((p) => !p.paid).slice(0, 3);

  return (
    <div className="space-y-8">
      <MembreHero
        firstName={progress.member.firstName}
        memberId={progress.member.id}
        periodName={progress.periodName}
        weeklyTarget={progress.weeklyTarget}
        enrolled={progress.enrolled}
      />

      {!progress.enrolled && (
        <MembreAlert>
          Vous n’êtes pas encore inscrit à une tontine. Vos cotisations, prêts et pénalités
          apparaîtront ici une fois l’inscription faite par le bureau.
        </MembreAlert>
      )}

      {progress.enrolled && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MembreStatCard
              label="Total cotisé"
              value={formatFcfa(progress.totalContributed)}
              icon={PiggyBank}
              tone="navy"
            />
            <MembreStatCard
              label="Séances payées"
              value={`${progress.weeksPaid} / ${progress.weeksTotal} (${pct}%)`}
              icon={Scale}
              tone="sand"
            />
            <MembreStatCard
              label="Pénalités dues"
              value={formatFcfa(progress.penaltiesDue)}
              icon={Receipt}
              tone="amber"
            />
            <MembreStatCard
              label="Prêts en cours"
              value={formatFcfa(progress.loansOutstanding)}
              icon={Handshake}
              tone="emerald"
            />
          </div>

          <div className="max-w-sm">
            <MembreStatCard
              label="Solde net estimé"
              value={formatFcfa(progress.netBalance)}
              icon={Wallet}
              tone="navy"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <MembrePanel
              title="Cotisations récentes"
              description="Derniers versements"
              action={
                <Link
                  href={`/membre/cotisations${q}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sand)] hover:text-[var(--navy)]"
                >
                  Tout voir <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {recentContributions.length === 0 ? (
                <MembreEmpty>Aucune cotisation pour le moment.</MembreEmpty>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {recentContributions.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="text-[var(--muted)]">{formatDate(c.paidAt)}</span>
                      <span className="font-semibold text-[var(--navy)]">
                        {formatFcfa(c.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </MembrePanel>

            <MembrePanel
              title="Prêts ouverts"
              description="En cours ou en retard"
              action={
                <Link
                  href={`/membre/prets${q}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sand)] hover:text-[var(--navy)]"
                >
                  Tout voir <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {openLoans.length === 0 ? (
                <MembreEmpty>Aucun prêt ouvert.</MembreEmpty>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {openLoans.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="font-mono text-xs text-[var(--muted)]">{l.id}</span>
                      <span className="font-semibold text-[var(--navy)]">
                        {formatFcfa(l.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </MembrePanel>

            <MembrePanel
              title="Pénalités ouvertes"
              description="À régler"
              action={
                <Link
                  href={`/membre/penalites${q}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sand)] hover:text-[var(--navy)]"
                >
                  Tout voir <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {openPenalties.length === 0 ? (
                <MembreEmpty>Aucune pénalité ouverte.</MembreEmpty>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {openPenalties.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="truncate text-[var(--muted)]">{p.motifLabel}</span>
                      <span className="shrink-0 font-semibold text-[var(--navy)]">
                        {formatFcfa(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </MembrePanel>
          </div>
        </>
      )}
    </div>
  );
}
