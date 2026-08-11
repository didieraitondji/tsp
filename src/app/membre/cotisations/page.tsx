import { formatFcfa } from "@/lib/format";
import { contributionCountedAmount } from "@/lib/contribution-status";
import { loadMembreContext } from "@/lib/membre-page";
import { DepositNumbersCard } from "@/components/deposit-numbers-card";
import { MembreCotisationsGrid } from "@/components/membre-cotisations-grid";
import { MembreAlert, MembreEmpty, MembrePanel } from "@/components/membre-ui";

export default async function MembreCotisationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tontine?: string }>;
}) {
  const sp = (await searchParams) || {};
  const ctx = await loadMembreContext(sp.tontine);

  if (!ctx.memberId || !ctx.progress) {
    return (
      <MembreAlert tone="error">
        Impossible d’afficher les cotisations. Vérifiez que votre fiche est liée.
      </MembreAlert>
    );
  }

  const { progress, depositSlots } = ctx;
  const paidCount = progress.contributions.filter(
    (c) => contributionCountedAmount(c) > 0
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
          Suivi
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--navy)]">
          Mes cotisations
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          {progress.periodName
            ? `Séances de « ${progress.periodName} » · cible ${formatFcfa(progress.weeklyTarget)}.`
            : "Sélectionnez une tontine pour voir vos cotisations."}
        </p>
      </div>

      {!progress.enrolled ? (
        <MembreAlert>
          Vous n’êtes pas inscrit à cette tontine. Contactez le bureau pour l’inscription.
        </MembreAlert>
      ) : (
        <>
          <DepositNumbersCard slots={depositSlots} />
          <MembrePanel
            title="Séances"
            description={`${paidCount} payée${paidCount === 1 ? "" : "s"} · ${progress.weeksTotal} séance${progress.weeksTotal === 1 ? "" : "s"}`}
          >
            {progress.weeks.length === 0 ? (
              <MembreEmpty>Aucune séance planifiée pour le moment.</MembreEmpty>
            ) : (
              <MembreCotisationsGrid
                weeks={progress.weeks}
                contributions={progress.contributions}
                weeklyTarget={progress.weeklyTarget}
              />
            )}
          </MembrePanel>
        </>
      )}
    </div>
  );
}
