import { formatDate, formatFcfa } from "@/lib/format";
import { loadMembreContext } from "@/lib/membre-page";
import { MembreAlert, MembreEmpty, MembrePanel } from "@/components/membre-ui";
import { Table, Td, Th } from "@/components/ui";

export default async function MembrePretsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tontine?: string }>;
}) {
  const sp = (await searchParams) || {};
  const ctx = await loadMembreContext(sp.tontine);

  if (!ctx.memberId || !ctx.progress) {
    return (
      <MembreAlert tone="error">
        Impossible d’afficher les prêts. Vérifiez que votre fiche est liée.
      </MembreAlert>
    );
  }

  const { progress } = ctx;
  const loans = [...progress.loans].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
          Suivi
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--navy)]">
          Mes prêts
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          {progress.periodName
            ? `Prêts sur « ${progress.periodName} ».`
            : "Sélectionnez une tontine pour voir vos prêts."}
        </p>
      </div>

      {!progress.enrolled ? (
        <MembreAlert>
          Vous n’êtes pas inscrit à cette tontine. Contactez le bureau pour l’inscription.
        </MembreAlert>
      ) : (
        <MembrePanel
          title="Liste des prêts"
          description={`En cours : ${formatFcfa(progress.loansOutstanding)}`}
        >
          {loans.length === 0 ? (
            <MembreEmpty>Aucun prêt pour cette tontine.</MembreEmpty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>ID</Th>
                    <Th>Date</Th>
                    <Th>Montant</Th>
                    <Th>Remboursé</Th>
                    <Th>Statut</Th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l) => (
                    <tr key={l.id}>
                      <Td className="font-mono text-xs">{l.id}</Td>
                      <Td>{formatDate(l.date)}</Td>
                      <Td className="font-semibold">{formatFcfa(l.amount)}</Td>
                      <Td>{formatFcfa(l.repaid)}</Td>
                      <Td>{l.status}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </MembrePanel>
      )}
    </div>
  );
}
