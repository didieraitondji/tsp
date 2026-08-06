import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getMemberProgress } from "@/lib/db/domain";
import { weeksRepo } from "@/lib/db/collections";
import { formatDate, formatFcfa } from "@/lib/format";
import { Alert, Card, PageHeader, Stat, Table, Td, Th } from "@/components/ui";

export default async function MembrePage() {
  const session = await requireRole(["MEMBRE", "SUPER_ADMIN"]);
  const memberId = session.user.memberId;

  if (!memberId) {
    return (
      <div>
        <PageHeader title="Ma progression" />
        <Alert tone="error">
          Aucun membre n’est lié à ce compte. Contactez le super admin pour associer votre fiche.
        </Alert>
      </div>
    );
  }

  const [progress, weeks] = await Promise.all([
    getMemberProgress(memberId),
    weeksRepo.all(),
  ]);

  if (!progress) {
    redirect("/login");
  }

  const weekById = new Map(weeks.map((w) => [w.id, w]));
  const pct =
    progress.weeksTotal > 0
      ? Math.round((progress.weeksPaid / progress.weeksTotal) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        title={`Bonjour ${progress.member.firstName}`}
        description={`${progress.member.id} · engagement ${formatFcfa(progress.weeklyTarget)} / semaine`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total cotisé" value={formatFcfa(progress.totalContributed)} />
        <Stat label="Semaines payées" value={`${progress.weeksPaid} / ${progress.weeksTotal} (${pct}%)`} />
        <Stat label="Pénalités dues" value={formatFcfa(progress.penaltiesDue)} />
        <Stat label="Prêts en cours" value={formatFcfa(progress.loansOutstanding)} />
      </div>

      <div className="mt-6 max-w-sm">
        <Stat label="Solde net estimé" value={formatFcfa(progress.netBalance)} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Card>
          <h2 className="font-[family-name:var(--font-display)] text-xl">Mes cotisations</h2>
          <Table>
            <thead>
              <tr>
                <Th>Semaine</Th>
                <Th>Montant</Th>
              </tr>
            </thead>
            <tbody>
              {progress.contributions.map((c) => (
                <tr key={c.id}>
                  <Td>{formatDate(weekById.get(c.weekId)?.date || c.paidAt)}</Td>
                  <Td>{formatFcfa(c.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {progress.missingWeeks.length > 0 && (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Semaines sans saisie : {progress.missingWeeks.slice(0, 8).join(", ")}
              {progress.missingWeeks.length > 8 ? "…" : ""}
            </p>
          )}
        </Card>

        <div className="space-y-8">
          <Card>
            <h2 className="font-[family-name:var(--font-display)] text-xl">Mes prêts</h2>
            {progress.loans.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Aucun prêt.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>ID</Th>
                    <Th>Montant</Th>
                    <Th>Remboursé</Th>
                    <Th>Statut</Th>
                  </tr>
                </thead>
                <tbody>
                  {progress.loans.map((l) => (
                    <tr key={l.id}>
                      <Td className="font-mono text-xs">{l.id}</Td>
                      <Td>{formatFcfa(l.amount)}</Td>
                      <Td>{formatFcfa(l.repaid)}</Td>
                      <Td>{l.status}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <h2 className="font-[family-name:var(--font-display)] text-xl">Mes pénalités</h2>
            {progress.penalties.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Aucune pénalité.</p>
            ) : (
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
                  {progress.penalties.map((p) => (
                    <tr key={p.id}>
                      <Td>{formatDate(p.date)}</Td>
                      <Td>{p.motifLabel}</Td>
                      <Td>{formatFcfa(p.amount)}</Td>
                      <Td>{p.paid ? "Oui" : "Non"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
