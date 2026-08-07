import { formatDate, formatFcfa } from "@/lib/format";
import { loadMembreContext } from "@/lib/membre-page";
import { MembreAlert, MembreEmpty, MembrePanel } from "@/components/membre-ui";
import { Table, Td, Th } from "@/components/ui";

export default async function MembrePenalitesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tontine?: string }>;
}) {
  const sp = (await searchParams) || {};
  const ctx = await loadMembreContext(sp.tontine);

  if (!ctx.memberId || !ctx.progress) {
    return (
      <MembreAlert tone="error">
        Impossible d’afficher les pénalités. Vérifiez que votre fiche est liée.
      </MembreAlert>
    );
  }

  const { progress } = ctx;
  const penalties = [...progress.penalties].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
          Suivi
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--navy)]">
          Mes pénalités
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          {progress.periodName
            ? `Pénalités sur « ${progress.periodName} ».`
            : "Sélectionnez une tontine pour voir vos pénalités."}
        </p>
      </div>

      {!progress.enrolled ? (
        <MembreAlert>
          Vous n’êtes pas inscrit à cette tontine. Contactez le bureau pour l’inscription.
        </MembreAlert>
      ) : (
        <MembrePanel
          title="Liste des pénalités"
          description={`Dû : ${formatFcfa(progress.penaltiesDue)}`}
        >
          {penalties.length === 0 ? (
            <MembreEmpty>Aucune pénalité pour cette tontine.</MembreEmpty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Motif</Th>
                    <Th>Montant</Th>
                    <Th>Payé</Th>
                  </tr>
                </thead>
                <tbody>
                  {penalties.map((p) => (
                    <tr key={p.id}>
                      <Td>{formatDate(p.date)}</Td>
                      <Td>{p.motifLabel}</Td>
                      <Td className="font-semibold">{formatFcfa(p.amount)}</Td>
                      <Td>{p.paid ? "Oui" : "Non"}</Td>
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
