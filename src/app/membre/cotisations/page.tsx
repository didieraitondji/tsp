import { formatDate, formatFcfa } from "@/lib/format";
import { loadMembreContext } from "@/lib/membre-page";
import { MembreAlert, MembreEmpty, MembrePanel } from "@/components/membre-ui";
import { Table, Td, Th } from "@/components/ui";

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

  const { progress } = ctx;
  const sorted = [...progress.contributions].sort((a, b) => b.paidAt.localeCompare(a.paidAt));

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
            ? `Historique pour « ${progress.periodName} ».`
            : "Sélectionnez une tontine pour voir vos cotisations."}
        </p>
      </div>

      {!progress.enrolled ? (
        <MembreAlert>
          Vous n’êtes pas inscrit à cette tontine. Contactez le bureau pour l’inscription.
        </MembreAlert>
      ) : (
        <MembrePanel
          title="Historique"
          description={`${sorted.length} versement${sorted.length === 1 ? "" : "s"} · ${progress.weeksPaid}/${progress.weeksTotal} séances`}
        >
          {sorted.length === 0 ? (
            <MembreEmpty>Aucune cotisation enregistrée pour le moment.</MembreEmpty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Montant</Th>
                    <Th>Statut</Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => (
                    <tr key={c.id}>
                      <Td>{formatDate(c.paidAt)}</Td>
                      <Td className="font-semibold">{formatFcfa(c.amount)}</Td>
                      <Td>{c.locked ? "Validé" : "Brouillon"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          {progress.missingWeeks.length > 0 && (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Séances sans saisie : {progress.missingWeeks.slice(0, 10).join(", ")}
              {progress.missingWeeks.length > 10 ? "…" : ""}
            </p>
          )}
        </MembrePanel>
      )}
    </div>
  );
}
