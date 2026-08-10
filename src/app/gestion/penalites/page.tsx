import { AlertTriangle, CheckCircle2, CircleDollarSign } from "lucide-react";
import { markPenaltyPaidAction } from "@/app/actions";
import { CreatePenaltyModal } from "@/components/create-penalty-modal";
import { DeletePenaltyButton } from "@/components/delete-penalty-button";
import { PenalitesTontineFilter } from "@/components/penalites-tontine-filter";
import { listEnrolledForPeriod } from "@/lib/db/collections";
import { memberDisplayName } from "@/lib/db/domain";
import { DEFAULT_SETTINGS } from "@/lib/db/defaults";
import { listPeriods } from "@/lib/db/periods";
import { readCollectionForPeriodId, readObjectForPeriodId } from "@/lib/db/store";
import { formatDate, formatFcfa } from "@/lib/format";
import { canWriteGestion } from "@/lib/auth/permissions";
import { requireGestionAccess } from "@/lib/auth/session";
import type { Penalty, Settings } from "@/lib/types";

export default async function PenalitesPage({
  searchParams,
}: {
  searchParams: Promise<{ tontine?: string; statut?: string; q?: string; date?: string }>;
}) {
  const session = await requireGestionAccess();
  const canWrite = canWriteGestion(session.user.role);

  const sp = await searchParams;
  const periods = await listPeriods();
  const periodId = sp.tontine?.trim() || periods[0]?.id || "";
  const period = periods.find((p) => p.id === periodId) ?? null;
  const statusFilter = sp.statut?.trim() || "all";
  const nameQuery = sp.q?.trim() || "";
  const dateFilter = sp.date?.trim() || "";

  const members = period ? await listEnrolledForPeriod(period.id) : [];
  const byId = new Map(members.map((m) => [m.id, m]));

  const penalties = period
    ? await readCollectionForPeriodId<Penalty>(period.id, "penalties")
    : [];
  const settings = period
    ? await readObjectForPeriodId<Settings>(period.id, "settings", DEFAULT_SETTINGS)
    : DEFAULT_SETTINGS;

  const penaltyTontines = await Promise.all(
    periods.map(async (p) => {
      const enrolled = await listEnrolledForPeriod(p.id);
      const s = await readObjectForPeriodId<Settings>(p.id, "settings", DEFAULT_SETTINGS);
      return {
        id: p.id,
        name: p.name,
        members: enrolled
          .filter((m) => m.status === "Actif")
          .map((m) => ({
            id: m.id,
            label: memberDisplayName(m),
          })),
        penaltyLateContribution: s.penaltyLateContribution,
        penaltyAbsence: s.penaltyAbsence,
      };
    })
  );

  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const nameNeedle = nameQuery ? normalize(nameQuery) : "";

  const filtered = penalties.filter((p) => {
    if (statusFilter === "paye" && !p.paid) return false;
    if (statusFilter === "impaye" && p.paid) return false;
    if (dateFilter && p.date !== dateFilter) return false;
    if (nameNeedle) {
      const m = byId.get(p.memberId);
      const label = m ? memberDisplayName(m) : p.memberId;
      if (!normalize(label).includes(nameNeedle)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );

  const unpaid = penalties.filter((p) => !p.paid);
  const unpaidTotal = unpaid.reduce((s, p) => s + p.amount, 0);
  const paidTotal = penalties.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
  const hasListFilters =
    statusFilter !== "all" || Boolean(nameQuery) || Boolean(dateFilter);

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
            Opérations
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Pénalités
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Retard cotisation : {formatFcfa(settings.penaltyLateContribution)} · Absence :{" "}
            {formatFcfa(settings.penaltyAbsence)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && periods.length > 0 && (
            <CreatePenaltyModal tontines={penaltyTontines} defaultPeriodId={periodId} />
          )}
        </div>
      </div>

      {!period ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          Créez une tontine pour gérer les pénalités.
        </p>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Impayées
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                    {unpaid.length}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-800">
                  <CircleDollarSign className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    À encaisser
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--navy)]">
                    {formatFcfa(unpaidTotal)}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Encaissé
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--navy)]">
                    {formatFcfa(paidTotal)}
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
                  {sorted.length} pénalité{sorted.length === 1 ? "" : "s"}
                  {hasListFilters ? " (filtrées)" : ""}
                </p>
              </div>
              <PenalitesTontineFilter
                periods={periods.map((p) => ({ id: p.id, name: p.name }))}
                value={periodId}
                statut={statusFilter}
                q={nameQuery}
                date={dateFilter}
              />
            </div>

            {sorted.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--cream)] text-[var(--sand)]">
                  <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <p className="mt-4 font-semibold text-[var(--navy)]">Aucune pénalité</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">
                  {canWrite
                    ? "Ajoutez une pénalité via le bouton ci-dessus, ou ajustez les filtres."
                    : "Aucune pénalité pour cette sélection."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-3 py-3 font-semibold">Membre</th>
                      <th className="px-3 py-3 font-semibold">Motif</th>
                      <th className="px-3 py-3 font-semibold">Montant</th>
                      <th className="px-3 py-3 font-semibold">Statut</th>
                      <th className="px-5 py-3 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p) => {
                      const m = byId.get(p.memberId);
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-[var(--line)] last:border-0 transition hover:bg-[#FFF8EB]/50"
                        >
                          <td className="px-5 py-3.5 text-[var(--muted)]">
                            {formatDate(p.date)}
                          </td>
                          <td className="px-3 py-3.5 font-medium text-[var(--navy)]">
                            {m ? memberDisplayName(m) : p.memberId}
                          </td>
                          <td className="px-3 py-3.5 text-[var(--navy)]">{p.motifLabel}</td>
                          <td className="px-3 py-3.5 tabular-nums font-medium text-[var(--navy)]">
                            {formatFcfa(p.amount)}
                          </td>
                          <td className="px-3 py-3.5">
                            {p.paid ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200">
                                Payé
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-inset ring-amber-200">
                                Impayé
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              {!p.paid && canWrite && (
                                <form action={markPenaltyPaidAction}>
                                  <input type="hidden" name="id" value={p.id} />
                                  <input type="hidden" name="periodId" value={periodId} />
                                  <button
                                    type="submit"
                                    className="cursor-pointer rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--cream)]"
                                  >
                                    Marquer payé
                                  </button>
                                </form>
                              )}
                              {canWrite && (
                                <DeletePenaltyButton
                                  penaltyId={p.id}
                                  periodId={periodId}
                                  memberLabel={m ? memberDisplayName(m) : p.memberId}
                                  motifLabel={p.motifLabel}
                                  amount={p.amount}
                                />
                              )}
                            </div>
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
