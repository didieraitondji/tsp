import { loadMembreContext } from "@/lib/membre-page";
import { DepositNumbersCard } from "@/components/deposit-numbers-card";
import { MembreAlert, MembreHero } from "@/components/membre-ui";
import { MembreDashboard } from "@/components/membre-dashboard";

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

  const { progress, periodId, depositSlots } = ctx;
  const q = periodId ? `?tontine=${encodeURIComponent(periodId)}` : "";

  return (
    <div className="space-y-6 md:space-y-8">
      <MembreHero
        firstName={progress.member.firstName}
        memberId={progress.member.id}
        periodName={progress.periodName}
        weeklyTarget={progress.weeklyTarget}
        enrolled={progress.enrolled}
      />

      {!progress.enrolled ? (
        <MembreAlert>
          Vous n’êtes pas encore inscrit à une tontine. Vos cotisations, prêts et pénalités
          apparaîtront ici une fois l’inscription faite par le bureau.
        </MembreAlert>
      ) : (
        <>
          <DepositNumbersCard slots={depositSlots} />
          <MembreDashboard progress={progress} periodQuery={q} />
        </>
      )}
    </div>
  );
}
