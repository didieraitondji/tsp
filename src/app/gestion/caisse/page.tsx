import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { CreateCashEntryModal } from "@/components/create-cash-entry-modal";
import { CaisseTontineFilter } from "@/components/caisse-tontine-filter";
import { listEnrolledForPeriod } from "@/lib/db/collections";
import {
  CASH_ORIGIN_CONTRIBUTION,
  CASH_ORIGIN_LOAN,
  CASH_ORIGIN_PENALTY,
  CASH_ORIGIN_REPAYMENT,
  reconcileContributionCashEntries,
  computeCashBalance,
  memberDisplayName,
  sortCashEntries,
} from "@/lib/db/domain";
import { DEFAULT_SETTINGS } from "@/lib/db/defaults";
import { listPeriods } from "@/lib/db/periods";
import { readCollectionForPeriodId, readObjectForPeriodId } from "@/lib/db/store";
import { formatDate, formatFcfa } from "@/lib/format";
import { normalizeSearch } from "@/lib/search";
import { canWriteGestion } from "@/lib/auth/permissions";
import { requireGestionAccess } from "@/lib/auth/session";
import type {
  CashEntry,
  Contribution,
  Loan,
  Penalty,
  Repayment,
  Settings,
} from "@/lib/types";

export default async function CaissePage({
  searchParams,
}: {
  searchParams: Promise<{
    tontine?: string;
    type?: string;
    q?: string;
    du?: string;
    au?: string;
  }>;
}) {
  const session = await requireGestionAccess();
  const canWrite = canWriteGestion(session.user.role);

  const sp = await searchParams;
  const periods = await listPeriods();
  const periodId = sp.tontine?.trim() || periods[0]?.id || "";
  const period = periods.find((p) => p.id === periodId) ?? null;
  const typeFilter = sp.type?.trim() || "all";
  const nameQuery = sp.q?.trim() || "";
  const dateFrom = sp.du?.trim() || "";
  const dateTo = sp.au?.trim() || "";

  if (period) {
    await reconcileContributionCashEntries(period.id);
  }

  const rawEntries = period
    ? await readCollectionForPeriodId<CashEntry>(period.id, "cashbook")
    : [];
  const settings = period
    ? await readObjectForPeriodId<Settings>(period.id, "settings", DEFAULT_SETTINGS)
    : DEFAULT_SETTINGS;

  const [members, contributions, loans, penalties, repayments] = period
    ? await Promise.all([
        listEnrolledForPeriod(period.id),
        readCollectionForPeriodId<Contribution>(period.id, "contributions"),
        readCollectionForPeriodId<Loan>(period.id, "loans"),
        readCollectionForPeriodId<Penalty>(period.id, "penalties"),
        readCollectionForPeriodId<Repayment>(period.id, "repayments"),
      ])
    : [[], [], [], [], []];

  const memberById = new Map(members.map((m) => [m.id, m]));
  const contributionById = new Map(contributions.map((c) => [c.id, c]));
  const loanById = new Map(loans.map((l) => [l.id, l]));
  const penaltyById = new Map(penalties.map((p) => [p.id, p]));
  const repaymentById = new Map(repayments.map((r) => [r.id, r]));

  function memberLabelForEntry(e: CashEntry): string {
    if (!e.reference) return "";
    let memberId: string | undefined;
    if (e.origin === CASH_ORIGIN_CONTRIBUTION) {
      memberId = contributionById.get(e.reference)?.memberId;
    } else if (e.origin === CASH_ORIGIN_LOAN) {
      memberId = loanById.get(e.reference)?.memberId;
    } else if (e.origin === CASH_ORIGIN_PENALTY) {
      memberId = penaltyById.get(e.reference)?.memberId;
    } else if (e.origin === CASH_ORIGIN_REPAYMENT) {
      const rem = repaymentById.get(e.reference);
      memberId = rem ? loanById.get(rem.loanId)?.memberId : undefined;
      // Anciennes écritures : référence = id prêt
      if (!memberId) memberId = loanById.get(e.reference)?.memberId;
    }
    if (!memberId) return "";
    const m = memberById.get(memberId);
    return m ? memberDisplayName(m) : "";
  }

  const entries = sortCashEntries(rawEntries);
  const balance = computeCashBalance(entries, settings.cashOpeningBalance);

  const totalIn = entries.reduce((s, e) => s + e.inflow, 0);
  const totalOut = entries.reduce((s, e) => s + e.outflow, 0);

  const nameNeedle = nameQuery ? normalizeSearch(nameQuery) : "";

  const filtered = entries.filter((e) => {
    if (typeFilter === "Entrée" && e.type !== "Entrée") return false;
    if (typeFilter === "Sortie" && e.type !== "Sortie") return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    if (nameNeedle) {
      const memberName = memberLabelForEntry(e);
      const haystack = normalizeSearch(
        [e.description, e.origin, e.reference, e.recordedBy, memberName]
          .filter(Boolean)
          .join(" ")
      );
      if (!haystack.includes(nameNeedle)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id)
  );

  const hasListFilters =
    typeFilter !== "all" || Boolean(nameQuery) || Boolean(dateFrom) || Boolean(dateTo);

  const tontineOptions = periods.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
            Opérations
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Caisse
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Journal réel : cotisations, prêts, remboursements, pénalités payées et écritures
            manuelles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && periods.length > 0 && (
            <CreateCashEntryModal tontines={tontineOptions} defaultPeriodId={periodId} />
          )}
        </div>
      </div>

      {!period ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          Créez une tontine pour gérer la caisse.
        </p>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1D2D50] text-[#FFCD79]">
                  <Wallet className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Solde actuel
                  </p>
                  <p
                    className={`font-[family-name:var(--font-display)] text-xl font-bold ${
                      balance < 0 ? "text-red-700" : "text-[var(--navy)]"
                    }`}
                  >
                    {formatFcfa(balance)}
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    Ouverture {formatFcfa(settings.cashOpeningBalance)}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                  <ArrowDownLeft className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Entrées
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--navy)]">
                    {formatFcfa(totalIn)}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-800">
                  <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Sorties
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--navy)]">
                    {formatFcfa(totalOut)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[var(--navy)]">{period.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {sorted.length} écriture{sorted.length === 1 ? "" : "s"}
                  {hasListFilters ? " (filtrées)" : ""}
                  {dateFrom || dateTo
                    ? ` · ${dateFrom && dateTo && dateFrom === dateTo
                        ? formatDate(dateFrom)
                        : [dateFrom ? `du ${formatDate(dateFrom)}` : null, dateTo ? `au ${formatDate(dateTo)}` : null]
                            .filter(Boolean)
                            .join(" ")}`
                    : ""}
                </p>
              </div>
              <CaisseTontineFilter
                periods={tontineOptions}
                value={periodId}
                type={typeFilter}
                q={nameQuery}
                du={dateFrom}
                au={dateTo}
              />
            </div>

            {sorted.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--cream)] text-[var(--sand)]">
                  <Wallet className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <p className="mt-4 font-semibold text-[var(--navy)]">Aucune écriture</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">
                  {hasListFilters
                    ? "Aucune écriture ne correspond à ces filtres."
                    : canWrite
                      ? "Les cotisations et prêts apparaissent ici automatiquement. Ajoutez une écriture manuelle si besoin."
                      : "Aucune écriture pour cette sélection."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-3 py-3 font-semibold">Type</th>
                      <th className="px-3 py-3 font-semibold">Description</th>
                      <th className="px-3 py-3 font-semibold">Entrée</th>
                      <th className="px-3 py-3 font-semibold">Sortie</th>
                      <th className="px-5 py-3 font-semibold">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((e) => {
                      const memberName = memberLabelForEntry(e);
                      return (
                        <tr
                          key={e.id}
                          className="border-b border-[var(--line)] last:border-0 transition hover:bg-[#FFF8EB]/50"
                        >
                          <td className="px-5 py-3.5 text-[var(--muted)]">
                            {formatDate(e.date)}
                          </td>
                          <td className="px-3 py-3.5">
                            {e.type === "Entrée" ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200">
                                Entrée
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 ring-1 ring-inset ring-red-200">
                                Sortie
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <p className="font-medium text-[var(--navy)]">
                              {memberName || e.description}
                            </p>
                            <p className="text-[11px] text-[var(--muted)]">
                              {(memberName
                                ? [e.description, e.origin, e.reference]
                                : [e.origin, e.reference]
                              )
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </td>
                          <td className="px-3 py-3.5 tabular-nums text-emerald-800">
                            {e.inflow ? formatFcfa(e.inflow) : "—"}
                          </td>
                          <td className="px-3 py-3.5 tabular-nums text-red-700">
                            {e.outflow ? formatFcfa(e.outflow) : "—"}
                          </td>
                          <td className="px-5 py-3.5 tabular-nums font-medium text-[var(--navy)]">
                            {formatFcfa(e.balance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
