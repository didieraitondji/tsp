import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { settingsRepo } from "@/lib/db/collections";
import { saveSettingsAction } from "@/app/actions";
import { Button, Input, Label } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";

export default async function ParametresPage() {
  await requireRole(["SUPER_ADMIN"]);
  const s = await settingsRepo.get();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
          Configuration
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
          Paramètres
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Règles financières de la tontine (modèle métier Solidarité Plus).
        </p>
      </div>

      <form action={saveSettingsAction} className="space-y-6">
        <Section
          title="Organisation"
          icon={<Settings className="h-4 w-4" />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nom de l’organisation</Label>
              <Input name="organizationName" defaultValue={s.organizationName} required />
            </div>
            <div>
              <Label>Année d’exercice</Label>
              <Input name="year" type="number" defaultValue={s.year} required />
            </div>
            <div>
              <Label>Solde d’ouverture caisse</Label>
              <Input name="cashOpeningBalance" type="number" defaultValue={s.cashOpeningBalance} />
            </div>
            <div>
              <Label>Nombre max de membres</Label>
              <Input name="maxMembers" type="number" defaultValue={s.maxMembers} />
            </div>
          </div>
        </Section>

        <Section title="Cotisations">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Cotisation minimum (FCFA)</Label>
              <Input name="contributionMin" type="number" defaultValue={s.contributionMin} />
            </div>
            <div>
              <Label>Cotisation standard (FCFA)</Label>
              <Input name="contributionStandard" type="number" defaultValue={s.contributionStandard} />
            </div>
          </div>
        </Section>

        <Section title="Prêts & intérêts">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Taux intérêt mensuel</Label>
              <Input
                name="interestRateMonthly"
                type="number"
                step="0.001"
                defaultValue={s.interestRateMonthly}
              />
            </div>
            <div>
              <Label>Taux supplémentaire (impayé)</Label>
              <Input
                name="interestRateExtra"
                type="number"
                step="0.001"
                defaultValue={s.interestRateExtra}
              />
            </div>
            <div>
              <Label>Frais retrait prêt (taux)</Label>
              <Input
                name="loanWithdrawalFeeRate"
                type="number"
                step="0.001"
                defaultValue={s.loanWithdrawalFeeRate}
              />
            </div>
            <div>
              <Label>Durée max prêt (mois)</Label>
              <Input
                name="loanMaxDurationMonths"
                type="number"
                defaultValue={s.loanMaxDurationMonths}
              />
            </div>
          </div>
        </Section>

        <Section title="Pénalités">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Pénalité retard cotisation</Label>
              <Input
                name="penaltyLateContribution"
                type="number"
                defaultValue={s.penaltyLateContribution}
              />
            </div>
            <div>
              <Label>Pénalité absence</Label>
              <Input name="penaltyAbsence" type="number" defaultValue={s.penaltyAbsence} />
            </div>
          </div>
        </Section>

        <Button type="submit" className="!rounded-full px-8">
          Enregistrer les paramètres
        </Button>
      </form>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="mb-4 flex items-center gap-2">
        {icon && <span className="text-[var(--sand)]">{icon}</span>}
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
