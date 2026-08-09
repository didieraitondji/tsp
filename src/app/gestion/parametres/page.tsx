import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarRange,
  Database,
  FileText,
  Scale,
  Settings2,
  Shield,
  Wallet,
} from "lucide-react";
import {
  closeEnrollmentsAction,
  closePeriodAction,
  selectPeriodAction,
} from "@/app/actions";
import { CreateTontineModal } from "@/components/create-tontine-modal";
import { DeletePeriodButton } from "@/components/delete-period-button";
import { AdminSettingsForm } from "@/components/admin-settings-form";
import { PasswordConfirmButton } from "@/components/password-confirm-button";
import { listPeriods } from "@/lib/db/periods";
import { DEFAULT_SETTINGS } from "@/lib/db/defaults";
import { getSelectedPeriodId, getStorageDiagnostics, readObjectForPeriodId } from "@/lib/db/store";
import { formatDate, formatFcfa, formatPercent } from "@/lib/format";
import { formatPeriodicity } from "@/lib/periodicity";
import { canWriteGestion } from "@/lib/auth/permissions";
import { requireGestionAccess } from "@/lib/auth/session";
import type { Period, Settings } from "@/lib/types";

const SECTIONS = [
  { id: "periodes", label: "Tontines", icon: CalendarRange },
  { id: "regles", label: "Règles financières", icon: Scale },
  { id: "operations", label: "Opérations", icon: Wallet },
  { id: "systeme", label: "Système", icon: Database },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function isSection(v: string | undefined): v is SectionId {
  return SECTIONS.some((s) => s.id === v);
}

export default async function GestionParametresPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; tontine?: string }>;
}) {
  const session = await requireGestionAccess();
  const canWrite = canWriteGestion(session.user.role);
  const sp = await searchParams;
  const section: SectionId = isSection(sp.section) ? sp.section : "periodes";

  const [periods, activeId, storage] = await Promise.all([
    listPeriods(),
    getSelectedPeriodId(),
    Promise.resolve(getStorageDiagnostics()),
  ]);

  const rulesPeriodId = sp.tontine?.trim() || activeId || periods[0]?.id || "";
  const rulesPeriod = periods.find((p) => p.id === rulesPeriodId) ?? null;
  const rulesSettings = rulesPeriod
    ? await readObjectForPeriodId(rulesPeriod.id, "settings", DEFAULT_SETTINGS)
    : DEFAULT_SETTINGS;

  const selectedPeriod = periods.find((p) => p.id === activeId) ?? null;
  const activeCount = periods.filter((p) => p.status === "active").length;

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
          Configuration
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
          Paramètres
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Gérez les tontines, personnalisez les règles financières et accédez aux outils
          opérationnels.
        </p>
      </div>

      <nav
        className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--line)] pb-px"
        aria-label="Sections paramètres"
      >
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <Link
              key={item.id}
              href={`/gestion/parametres?section=${item.id}`}
              className={`flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-[#1D2D50] text-[#FFCD79]"
                  : "text-[var(--navy)] hover:bg-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="min-w-0">
        {section === "periodes" && (
          <TontinesSection
            periods={periods}
            activeId={activeId}
            selectedPeriodName={selectedPeriod?.name}
            activeCount={activeCount}
            canWrite={canWrite}
          />
        )}
        {section === "regles" && (
          <ReglesSection
            periods={periods.map((p) => ({ id: p.id, name: p.name }))}
            periodId={rulesPeriodId}
            periodName={rulesPeriod?.name ?? null}
            settings={rulesSettings}
            canWrite={canWrite}
          />
        )}
        {section === "operations" && <OperationsSection />}
        {section === "systeme" && <SystemeSection storage={storage} />}
      </div>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 md:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--navy)]">
            {title}
          </h2>
          {description && <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "active"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : status === "draft"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : "bg-[var(--cream)] text-[var(--muted)] ring-[var(--line)]";
  const label =
    status === "active" ? "Active" : status === "draft" ? "Brouillon" : "Clôturée";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${styles}`}
    >
      {label}
    </span>
  );
}

function TontinesSection({
  periods,
  activeId,
  selectedPeriodName,
  activeCount,
  canWrite,
}: {
  periods: Period[];
  activeId: string | null;
  selectedPeriodName?: string;
  activeCount: number;
  canWrite: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#FFCD79]/50 bg-gradient-to-br from-[#FFF8EB] to-[var(--panel)] p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1D2D50] text-[#FFCD79]">
            <CalendarRange className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sand)]">
              Tontine sélectionnée
            </p>
            <p className="mt-0.5 text-lg font-semibold text-[var(--navy)]">
              {selectedPeriodName ?? "Aucune tontine sélectionnée"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Plusieurs tontines peuvent tourner en parallèle ({activeCount} active
          {activeCount > 1 ? "s" : ""}). La sélection indique sur laquelle vous travaillez
          (cotisations, prêts…). Les données restent isolées par tontine ; l’annuaire membres
          est global.
        </p>
      </div>

      <Panel
        title="Tontines"
        description="Créez plusieurs cycles, sélectionnez celui sur lequel travailler, clôturez les inscriptions ou une tontine terminée."
        action={
          canWrite ? (
            <CreateTontineModal
              redirectTo="/gestion/parametres?section=periodes"
              triggerClassName="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1D2D50] px-4 py-2.5 text-sm font-semibold text-[#FFCD79] transition hover:bg-[#152238]"
            />
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="pb-3 pr-3 font-semibold">Nom</th>
                <th className="pb-3 pr-3 font-semibold">Dates</th>
                <th className="pb-3 pr-3 font-semibold">Périodicité</th>
                <th className="pb-3 pr-3 font-semibold">Inscriptions</th>
                <th className="pb-3 pr-3 font-semibold">Statut</th>
                <th className="pb-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {periods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--muted)]">
                    Aucune tontine. Utilisez « Créer une tontine » pour démarrer.
                  </td>
                </tr>
              ) : (
                periods.map((p) => {
                  const isActive = p.status === "active";
                  const isSelected = p.id === activeId;
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-[var(--line)] last:border-0 ${
                        isSelected ? "bg-[#FFF8EB]/60" : ""
                      }`}
                    >
                      <td className="py-3.5 pr-3 font-medium text-[var(--navy)]">
                        {p.name}
                        {isSelected && (
                          <span className="ml-2 text-xs font-normal text-[var(--sand)]">
                            (sélectionnée)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 pr-3 text-[var(--muted)]">
                        {formatDate(p.startDate)} → {formatDate(p.endDate)}
                      </td>
                      <td className="py-3.5 pr-3">{formatPeriodicity(p.periodicity)}</td>
                      <td className="py-3.5 pr-3">
                        {p.enrollmentsOpen !== false ? (
                          <span className="text-emerald-800">Ouvertes</span>
                        ) : (
                          <span className="text-[var(--muted)]">Clôturées</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="py-3.5">
                        <div className="flex flex-wrap gap-2">
                          {!isSelected && (
                            <form action={selectPeriodAction}>
                              <input type="hidden" name="periodId" value={p.id} />
                              <input
                                type="hidden"
                                name="redirectTo"
                                value="/gestion/parametres?section=periodes"
                              />
                              <button
                                type="submit"
                                className="cursor-pointer rounded-lg bg-[#1D2D50] px-2.5 py-1.5 text-xs font-semibold text-[#FFCD79] transition hover:bg-[#152238]"
                                title={
                                  isActive
                                    ? "Travailler sur cette tontine (cotisations, prêts…)"
                                    : "Consulter l’historique de cette tontine clôturée"
                                }
                              >
                                {isActive ? "Sélectionner" : "Consulter"}
                              </button>
                            </form>
                          )}
                          {canWrite && isActive && p.enrollmentsOpen && (
                            <PasswordConfirmButton
                              action={closeEnrollmentsAction}
                              periodId={p.id}
                              title="Clôturer les inscriptions"
                              description={
                                <>
                                  Plus aucun membre ne pourra être inscrit à{" "}
                                  <strong className="text-[var(--navy)]">{p.name}</strong>.
                                  Les cotisations et prêts déjà enregistrés restent inchangés.
                                </>
                              }
                              confirmLabel="Clôturer les inscriptions"
                              pendingLabel="Clôture…"
                              triggerLabel="Clôturer inscriptions"
                              triggerClassName="cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--cream)]"
                            />
                          )}
                          {canWrite && isActive && (
                            <PasswordConfirmButton
                              action={closePeriodAction}
                              periodId={p.id}
                              title="Clôturer la tontine"
                              description={
                                <>
                                  Vous allez clôturer{" "}
                                  <strong className="text-[var(--navy)]">{p.name}</strong>.
                                  Elle ne pourra plus recevoir de nouvelles opérations. Vous
                                  pourrez ensuite la supprimer si besoin.
                                </>
                              }
                              confirmLabel="Clôturer la tontine"
                              pendingLabel="Clôture…"
                              triggerLabel="Clôturer tontine"
                              triggerClassName="cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--cream)]"
                              tone="danger"
                            />
                          )}
                          {canWrite && !isActive && (
                            <DeletePeriodButton periodId={p.id} periodName={p.name} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function ReglesSection({
  periods,
  periodId,
  periodName,
  settings,
  canWrite,
}: {
  periods: { id: string; name: string }[];
  periodId: string;
  periodName: string | null;
  settings: Settings;
  canWrite: boolean;
}) {
  if (periods.length === 0) {
    return (
      <p className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-10 text-center text-sm text-[var(--muted)]">
        Créez une tontine pour consulter ou modifier ses règles financières.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <Panel
        title="Règles financières"
        description={
          periodName
            ? canWrite
              ? `Personnalisez les barèmes de « ${periodName} » (cotisations, prêts, pénalités).`
              : `Barèmes de « ${periodName} » (lecture seule).`
            : "Barèmes appliqués aux cotisations, prêts et pénalités."
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Tontine
          </span>
          {periods.map((p) => (
            <Link
              key={p.id}
              href={`/gestion/parametres?section=regles&tontine=${p.id}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                p.id === periodId
                  ? "bg-[#1D2D50] text-[#FFCD79]"
                  : "border border-[var(--line)] text-[var(--navy)] hover:bg-[var(--cream)]"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      </Panel>

      {canWrite && periodId ? (
        <AdminSettingsForm
          key={periodId}
          settings={settings}
          periodId={periodId}
          periodName={periodName}
        />
      ) : (
        <Panel title="Barèmes en vigueur" description="Consultation uniquement.">
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Organisation", value: settings.organizationName },
              { label: "Cotisation minimum", value: formatFcfa(settings.contributionMin) },
              { label: "Cotisation standard", value: formatFcfa(settings.contributionStandard) },
              {
                label: "Taux d’intérêt mensuel",
                value: formatPercent(settings.interestRateMonthly),
              },
              {
                label: "Taux supplémentaire (impayé)",
                value: formatPercent(settings.interestRateExtra),
              },
              {
                label: "Frais de retrait prêt",
                value: formatPercent(settings.loanWithdrawalFeeRate),
              },
              {
                label: "Durée max prêt",
                value: `${settings.loanMaxDurationMonths} mois`,
              },
              {
                label: "Pénalité retard cotisation",
                value: formatFcfa(settings.penaltyLateContribution),
              },
              { label: "Pénalité absence", value: formatFcfa(settings.penaltyAbsence) },
              { label: "Plafond de membres", value: String(settings.maxMembers) },
              {
                label: "MDP pour déverrouiller cotisation",
                value:
                  settings.requirePasswordToUnlockContribution !== false
                    ? "Activé"
                    : "Désactivé",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="rounded-xl border border-[var(--line)] bg-[var(--cream)]/40 px-4 py-3"
              >
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {row.label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[var(--navy)]">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}
    </div>
  );
}

function OperationsSection() {
  const links = [
    {
      href: "/gestion/cotisations",
      title: "Cotisations & séances",
      text: "Enregistrer les paiements et suivre la progression du cycle.",
      icon: FileText,
    },
    {
      href: "/gestion/caisse",
      title: "Caisse & transparence",
      text: "Journal des entrées/sorties pour une caisse lisible par le groupe.",
      icon: Wallet,
    },
    {
      href: "/gestion/membres",
      title: "Membres du cercle",
      text: "Inscriptions à la tontine et annuaire global.",
      icon: Settings2,
    },
    {
      href: "/gestion/profil",
      title: "Mon compte",
      text: "Identité et rôle utilisés pour l’audit des actions.",
      icon: Shield,
    },
  ];

  return (
    <Panel
      title="Opérations & transparence"
      description="Raccourcis vers les outils du quotidien — suivi des séances, caisse, membres."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--cream)]/40 p-4 transition hover:border-[#FFCD79] hover:bg-white"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1D2D50] text-[#FFCD79]">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-semibold text-[var(--navy)]">
                  {item.title}
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 block text-sm text-[var(--muted)]">{item.text}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}

function SystemeSection({
  storage,
}: {
  storage: ReturnType<typeof getStorageDiagnostics>;
}) {
  const modeLabel = storage.mode === "mongodb" ? "MongoDB Atlas" : "Fichiers locaux";

  return (
    <Panel
      title="Système & stockage"
      description="État technique de la plateforme pour le diagnostic."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--cream)]/40 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Mode de stockage
          </p>
          <p className="mt-1 font-semibold text-[var(--navy)]">{modeLabel}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--cream)]/40 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            MongoDB
          </p>
          <p className="mt-1 font-semibold text-[var(--navy)]">
            {storage.mongoUri ? "Configuré" : "Non configuré"}
          </p>
        </div>
      </div>
      {storage.hint && (
        <p className="mt-4 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
          {storage.hint}
        </p>
      )}
    </Panel>
  );
}
