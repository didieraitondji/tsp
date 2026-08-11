"use client";

import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  Coins,
  Handshake,
  Percent,
  Scale,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { saveSettingsAction, type SaveSettingsState } from "@/app/actions";
import { PasswordInput } from "@/components/password-input";
import { PhoneInput } from "@/components/phone-input";
import { Input, Label } from "@/components/ui";
import { formatFcfa, formatPercent } from "@/lib/format";
import type { Settings } from "@/lib/types";

function toPercentInput(rate: number): string {
  const p = rate * 100;
  return String(Number(p.toFixed(3)));
}

export function AdminSettingsForm({
  settings,
  periodId,
  periodName,
}: {
  settings: Settings;
  /** Si fourni, enregistre les règles sur cette tontine. */
  periodId?: string;
  periodName?: string | null;
}) {
  const [state, formAction, pending] = useActionState<SaveSettingsState, FormData>(
    saveSettingsAction,
    null
  );
  const [interestMonthly, setInterestMonthly] = useState(toPercentInput(settings.interestRateMonthly));
  const [interestExtra, setInterestExtra] = useState(toPercentInput(settings.interestRateExtra));
  const [withdrawalFee, setWithdrawalFee] = useState(
    toPercentInput(settings.loanWithdrawalFeeRate)
  );
  const [contribMin, setContribMin] = useState(String(settings.contributionMin));
  const [contribStd, setContribStd] = useState(String(settings.contributionStandard));
  const [exampleAmount, setExampleAmount] = useState("2000");

  useEffect(() => {
    setInterestMonthly(toPercentInput(settings.interestRateMonthly));
    setInterestExtra(toPercentInput(settings.interestRateExtra));
    setWithdrawalFee(toPercentInput(settings.loanWithdrawalFeeRate));
    setContribMin(String(settings.contributionMin));
    setContribStd(String(settings.contributionStandard));
  }, [settings]);

  const preview = useMemo(() => {
    const amount = Number(exampleAmount) || 0;
    const feeRate = Number(String(withdrawalFee).replace(",", ".")) / 100;
    const intRate = Number(String(interestMonthly).replace(",", ".")) / 100;
    const fee = Math.round(amount * (Number.isFinite(feeRate) ? feeRate : 0));
    const interest = Math.round(amount * (Number.isFinite(intRate) ? intRate : 0));
    return {
      fee,
      cashOut: amount + fee,
      interestMonth: interest,
      totalDueApprox: amount + interest,
      note: "1 mois d’intérêt (exemple) — le réel dépend des dates du prêt",
    };
  }, [exampleAmount, withdrawalFee, interestMonthly]);

  return (
    <form action={formAction} className="space-y-6">
      {periodId ? <input type="hidden" name="periodId" value={periodId} /> : null}
      {periodName ? (
        <p className="rounded-xl border border-[#FFCD79]/50 bg-[#FFF8EB] px-4 py-3 text-sm text-[var(--navy)]">
          Modification des règles de la tontine{" "}
          <strong className="font-semibold">« {periodName} »</strong>.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Cotisation standard"
          value={formatFcfa(Number(contribStd) || 0)}
          hint={`Min. ${formatFcfa(Number(contribMin) || 0)}`}
        />
        <SummaryCard
          label="Intérêt mensuel"
          value={`${interestMonthly || "0"} %`}
          hint={`Retard ${interestExtra || "0"} % / mois`}
        />
        <SummaryCard
          label="Frais de retrait"
          value={`${withdrawalFee || "0"} %`}
          hint="Prélevé à la caisse au décaissement"
          highlight
        />
        <SummaryCard
          label="Pénalités"
          value={formatFcfa(settings.penaltyLateContribution)}
          hint={`Absence ${formatFcfa(settings.penaltyAbsence)}`}
        />
      </div>

      <Section
        title="Organisation"
        description="Identité et cadrage de l’exercice."
        icon={<Building2 className="h-4 w-4" strokeWidth={1.75} />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nom de l’organisation</Label>
            <Input name="organizationName" defaultValue={settings.organizationName} required />
          </div>
          <div>
            <Label>Année d’exercice</Label>
            <Input name="year" type="number" defaultValue={settings.year} required />
          </div>
          <div>
            <Label>Solde d’ouverture caisse (FCFA)</Label>
            <Input
              name="cashOpeningBalance"
              type="number"
              defaultValue={settings.cashOpeningBalance}
            />
          </div>
          <div>
            <Label>Nombre max de membres</Label>
            <Input name="maxMembers" type="number" min={1} defaultValue={settings.maxMembers} />
          </div>
        </div>
      </Section>

      <Section
        title="Cotisations"
        description="Montants de référence et sécurité de la grille."
        icon={<Coins className="h-4 w-4" strokeWidth={1.75} />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Cotisation minimum (FCFA)</Label>
            <Input
              name="contributionMin"
              type="number"
              min={0}
              value={contribMin}
              onChange={(e) => setContribMin(e.target.value)}
            />
          </div>
          <div>
            <Label>Cotisation standard (FCFA)</Label>
            <Input
              name="contributionStandard"
              type="number"
              min={0}
              value={contribStd}
              onChange={(e) => setContribStd(e.target.value)}
            />
          </div>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--cream)]/50 px-4 py-3">
          <input
            type="checkbox"
            name="requirePasswordToUnlockContribution"
            value="on"
            defaultChecked={settings.requirePasswordToUnlockContribution !== false}
            className="mt-1 h-4 w-4 rounded border-[var(--line)] text-[var(--navy)] accent-[#1D2D50]"
          />
          <span>
            <span className="block text-sm font-semibold text-[var(--navy)]">
              Mot de passe pour déverrouiller une cotisation
            </span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Activé : confirmation par mot de passe. Désactivé : déverrouillage immédiat
              (utile pour valider la grille avec le comptable).
            </span>
          </span>
        </label>
      </Section>

      <Section
        title="Dépôt des mises"
        description="Numéros Mobile Money affichés aux membres pour verser leur cible."
        icon={<Smartphone className="h-4 w-4" strokeWidth={1.75} />}
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--cream)]/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Numéro 1
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Téléphone</Label>
                <PhoneInput
                  name="depositPhone1"
                  showIcon={false}
                  defaultValue={settings.depositPhone1 || ""}
                />
              </div>
              <div>
                <Label>Nom d’enregistrement</Label>
                <Input
                  name="depositName1"
                  defaultValue={settings.depositName1 || ""}
                  placeholder="Ex. AGBLE VIDEHOU VENAS"
                />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--cream)]/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Numéro 2 <span className="font-normal normal-case">(optionnel)</span>
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Téléphone</Label>
                <PhoneInput
                  name="depositPhone2"
                  showIcon={false}
                  defaultValue={settings.depositPhone2 || ""}
                />
              </div>
              <div>
                <Label>Nom d’enregistrement</Label>
                <Input
                  name="depositName2"
                  defaultValue={settings.depositName2 || ""}
                  placeholder="Si un 2ᵉ numéro est utilisé"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Si un seul numéro est renseigné, le message membre parlera d’un numéro. Avec
            deux numéros, le texte s’adapte automatiquement.
          </p>
        </div>
      </Section>

      <Section
        title="Prêts & intérêts"
        description="Les taux se saisissent en pourcentage (ex. 2 pour 2 %)."
        icon={<Handshake className="h-4 w-4" strokeWidth={1.75} />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Taux intérêt mensuel (%)</Label>
            <Input
              name="interestRateMonthly"
              type="number"
              min={0}
              step="0.1"
              value={interestMonthly}
              onChange={(e) => setInterestMonthly(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Actuel décimal : {formatPercent(settings.interestRateMonthly)}
            </p>
          </div>
          <div>
            <Label>Taux après échéance — retard (%)</Label>
            <Input
              name="interestRateExtra"
              type="number"
              min={0}
              step="0.1"
              value={interestExtra}
              onChange={(e) => setInterestExtra(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Appliqué automatiquement chaque mois de retard sur le capital restant
              (règle bureau : 15 %).
            </p>
          </div>
          <div>
            <Label>Frais de retrait prêt (%)</Label>
            <Input
              name="loanWithdrawalFeeRate"
              type="number"
              min={0}
              step="0.1"
              value={withdrawalFee}
              onChange={(e) => setWithdrawalFee(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              À la charge du demandeur — sortie caisse = montant + frais.
            </p>
          </div>
          <div>
            <Label>Durée max prêt (mois)</Label>
            <Input
              name="loanMaxDurationMonths"
              type="number"
              min={1}
              defaultValue={settings.loanMaxDurationMonths}
            />
          </div>
          <div>
            <Label>Seuil 2ᵉ caution (FCFA)</Label>
            <Input
              name="loanSecondWitnessThreshold"
              type="number"
              min={0}
              step={1000}
              defaultValue={
                settings.loanSecondWitnessThreshold ??
                20000
              }
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Au-delà de ce montant, 2 cautions sont exigées (dont ≥ 1 membre).
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-[#FFCD79]/60 bg-[#FFF8EB] p-4">
          <div className="flex items-center gap-2 text-[var(--navy)]">
            <Percent className="h-4 w-4 text-[var(--sand)]" strokeWidth={1.75} />
            <p className="text-sm font-semibold">Aperçu sur un prêt exemple</p>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[8rem]">
              <Label>Montant exemple (FCFA)</Label>
              <Input
                type="number"
                min={0}
                value={exampleAmount}
                onChange={(e) => setExampleAmount(e.target.value)}
              />
            </div>
            <div className="grid flex-1 gap-2 text-sm sm:grid-cols-3">
              <PreviewStat label="Frais retrait" value={formatFcfa(preview.fee)} />
              <PreviewStat label="Sortie caisse" value={formatFcfa(preview.cashOut)} />
              <PreviewStat
                label="Intérêt / mois (approx.)"
                value={formatFcfa(preview.interestMonth)}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Pénalités"
        description="Montants appliqués en cas de retard ou d’absence."
        icon={<ShieldAlert className="h-4 w-4" strokeWidth={1.75} />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Pénalité retard cotisation (FCFA)</Label>
            <Input
              name="penaltyLateContribution"
              type="number"
              min={0}
              defaultValue={settings.penaltyLateContribution}
            />
          </div>
          <div>
            <Label>Pénalité absence (FCFA)</Label>
            <Input
              name="penaltyAbsence"
              type="number"
              min={0}
              defaultValue={settings.penaltyAbsence}
            />
          </div>
        </div>
      </Section>

      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
              <Scale className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--navy)]">Confirmer et enregistrer</p>
              <p className="text-xs text-[var(--muted)]">
                Modification sensible — mot de passe obligatoire.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div className="flex gap-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <p>
              {periodId
                ? "Ces barèmes s’appliquent aux prochaines opérations de cette tontine (cotisations, prêts, pénalités). Les prêts déjà créés conservent leurs frais figés."
                : "Ces règles servent de modèle pour le contexte courant. Chaque tontine peut aussi avoir ses propres barèmes dans Gestion → Paramètres → Règles."}
            </p>
          </div>
          <div className="max-w-sm">
            <Label>Mot de passe</Label>
            <PasswordInput
              key={state?.ok ? "ok" : "edit"}
              name="password"
              required
              autoComplete="current-password"
            />
          </div>
          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {state.error}
            </p>
          )}
          {state?.ok && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Paramètres enregistrés.
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer rounded-full bg-[#1D2D50] px-6 py-2.5 text-sm font-semibold text-[#FFCD79] transition hover:bg-[#152238] disabled:opacity-60"
          >
            {pending ? "Enregistrement…" : "Enregistrer les paramètres"}
          </button>
        </div>
      </section>
    </form>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        highlight
          ? "border-[#FFCD79] bg-[#FFF8EB]"
          : "border-[var(--line)] bg-[var(--panel)]"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--navy)]">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/70 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--navy)]">{value}</p>
    </div>
  );
}

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-start gap-3 border-b border-[var(--line)] px-5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1D2D50] text-[#FFCD79]">
          {icon}
        </span>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
            {title}
          </h2>
          <p className="text-xs text-[var(--muted)]">{description}</p>
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}
