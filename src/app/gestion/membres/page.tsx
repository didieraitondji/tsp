import Link from "next/link";
import { UserRound, Users, UserCheck } from "lucide-react";
import {
  globalMembersRepo,
  listEnrolledForPeriod,
  settingsRepo,
  usersRepo,
} from "@/lib/db/collections";
import { listPeriods } from "@/lib/db/periods";
import { readCollectionForPeriodId } from "@/lib/db/store";
import { formatFcfa, formatDate } from "@/lib/format";
import { CreateMemberModal } from "@/components/create-member-modal";
import { CreateTontineModal } from "@/components/create-tontine-modal";
import { EditWeeklyTargetButton } from "@/components/edit-weekly-target-button";
import { EnrollMemberModal } from "@/components/enroll-member-modal";
import { InscritsTontineFilter } from "@/components/inscrits-tontine-filter";
import { MemberRowActions } from "@/components/member-row-actions";
import { formatMemberShortName } from "@/components/contributions-table-ui";
import { canWriteGestion } from "@/lib/auth/permissions";
import { requireGestionAccess } from "@/lib/auth/session";
import type { Enrollment, Member, MemberStatus } from "@/lib/types";

function initials(lastName: string, firstName: string): string {
  const a = (lastName || "").trim()[0] || "";
  const b = (firstName || "").trim()[0] || "";
  return `${a}${b}`.toUpperCase() || "?";
}

function StatusPill({ status }: { status: MemberStatus }) {
  const styles =
    status === "Actif"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : status === "Suspendu"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : "bg-[var(--cream)] text-[var(--muted)] ring-[var(--line)]";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${styles}`}
    >
      {status}
    </span>
  );
}

function DirectoryTable({
  members,
  enrolledAnywhereIds,
  memberIdsWithAccount,
  canWrite,
}: {
  members: Member[];
  enrolledAnywhereIds: Set<string>;
  memberIdsWithAccount: Set<string>;
  canWrite: boolean;
}) {
  if (members.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--cream)] text-[var(--sand)]">
          <UserRound className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <p className="mt-4 font-semibold text-[var(--navy)]">Annuaire vide</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">
          Créez le premier membre via le bouton Nouveau membre.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <th className="px-5 py-3 font-semibold">Membre</th>
            <th className="px-3 py-3 font-semibold">Téléphone</th>
            <th className="px-3 py-3 font-semibold">Depuis</th>
            <th className="px-3 py-3 font-semibold">Inscriptions</th>
            <th className="px-5 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              key={m.id}
              className="border-b border-[var(--line)] last:border-0 transition hover:bg-[#FFF8EB]/50"
            >
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1D2D50] text-xs font-bold text-[#FFCD79]">
                    {initials(m.lastName, m.firstName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--navy)]">
                      {m.lastName} {m.firstName}
                    </p>
                    <p className="truncate font-mono text-[11px] text-[var(--muted)]">{m.id}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3.5 tabular-nums text-[var(--muted)]">{m.phone || "—"}</td>
              <td className="px-3 py-3.5 text-[var(--muted)]">{formatDate(m.joinedAt)}</td>
              <td className="px-3 py-3.5">
                {enrolledAnywhereIds.has(m.id) ? (
                  <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200">
                    Inscrit
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-[var(--cream)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] ring-1 ring-inset ring-[var(--line)]">
                    Non inscrit
                  </span>
                )}
              </td>
              <td className="px-5 py-3.5">
                {canWrite ? (
                  <MemberRowActions
                    member={m}
                    hasMemberAccount={memberIdsWithAccount.has(m.id)}
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MembresPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tontine?: string }>;
}) {
  const session = await requireGestionAccess();
  const canWrite = canWriteGestion(session.user.role);
  const sp = await searchParams;
  const [allMembers, settings, periods, users] = await Promise.all([
    globalMembersRepo.all(),
    settingsRepo.get(),
    listPeriods(),
    usersRepo.all(),
  ]);

  const memberIdsWithAccount = new Set(
    users.map((u) => u.memberId).filter((id): id is string => Boolean(id))
  );

  const view = sp.view === "inscrits" ? "inscrits" : "annuaire";
  const filterTontineId =
    sp.tontine?.trim() ||
    (view === "inscrits" ? periods[0]?.id ?? "" : "");
  const filterPeriod = periods.find((p) => p.id === filterTontineId) ?? null;

  const enrolled =
    view === "inscrits" && filterTontineId
      ? await listEnrolledForPeriod(filterTontineId)
      : [];

  const openTontines = periods.filter(
    (p) => p.status === "active" && p.enrollmentsOpen !== false
  );
  const enrollTontines = await Promise.all(
    openTontines.map(async (p) => {
      const enrollments = await readCollectionForPeriodId<Enrollment>(p.id, "enrollments");
      return {
        id: p.id,
        name: p.name,
        enrolledMemberIds: enrollments.map((e) => e.memberId),
      };
    })
  );

  const enrolledAnywhereIds = new Set<string>();
  await Promise.all(
    periods.map(async (p) => {
      const enrollments = await readCollectionForPeriodId<Enrollment>(p.id, "enrollments");
      for (const e of enrollments) enrolledAnywhereIds.add(e.memberId);
    })
  );

  const canEnroll = enrollTontines.length > 0 && allMembers.length > 0;
  const filterEnrollmentsOpen = Boolean(filterPeriod && filterPeriod.enrollmentsOpen !== false);
  const actifs = enrolled.filter((m) => m.status === "Actif").length;

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
            Registre
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Membres
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Annuaire global partagé · inscrivez chaque membre aux tontines de votre choix.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && <CreateTontineModal />}
          {canWrite && canEnroll && (
            <EnrollMemberModal
              tontines={enrollTontines}
              directoryMembers={allMembers.map((m) => ({
                id: m.id,
                lastName: m.lastName,
                firstName: m.firstName,
              }))}
              contributionMin={settings.contributionMin}
              defaultPeriodId={filterTontineId || openTontines[0]?.id}
            />
          )}
          {canWrite && <CreateMemberModal />}
        </div>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--cream)] text-[var(--sand)]">
              <UserRound className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Annuaire
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {allMembers.length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1D2D50] text-[#FFCD79]">
              <Users className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Inscrits
                {filterPeriod && view === "inscrits" ? ` · ${filterPeriod.name}` : ""}
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {view === "inscrits" && filterPeriod ? enrolled.length : enrolledAnywhereIds.size}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
              <UserCheck className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Actifs
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {view === "inscrits" && filterPeriod ? actifs : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl bg-[var(--cream)]/60 p-1">
              <Link
                href="/gestion/membres?view=annuaire"
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  view === "annuaire"
                    ? "bg-[#1D2D50] text-[#FFCD79]"
                    : "text-[var(--muted)] hover:text-[var(--navy)]"
                }`}
              >
                Annuaire
              </Link>
              <Link
                href={`/gestion/membres?view=inscrits${
                  filterTontineId ? `&tontine=${filterTontineId}` : periods[0] ? `&tontine=${periods[0].id}` : ""
                }`}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  view === "inscrits"
                    ? "bg-[#1D2D50] text-[#FFCD79]"
                    : "text-[var(--muted)] hover:text-[var(--navy)]"
                }`}
              >
                Inscrits
              </Link>
            </div>
            {view === "inscrits" && periods.length > 0 && (
              <InscritsTontineFilter
                periods={periods.map((p) => ({ id: p.id, name: p.name }))}
                value={filterTontineId}
              />
            )}
          </div>
          <span className="text-xs font-medium text-[var(--muted)]">
            {view === "inscrits"
              ? `${enrolled.length} inscrit${enrolled.length === 1 ? "" : "s"}`
              : `${allMembers.length} membre${allMembers.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {view === "inscrits" ? (
          periods.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-semibold text-[var(--navy)]">Aucune tontine</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">
                Créez une tontine pour y inscrire des membres.
              </p>
            </div>
          ) : enrolled.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--cream)] text-[var(--sand)]">
                <Users className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 font-semibold text-[var(--navy)]">Aucun inscrit</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">
                {filterEnrollmentsOpen
                  ? `Personne n’est encore inscrit${filterPeriod ? ` à « ${filterPeriod.name} »` : ""}.`
                  : "Les inscriptions sont clôturées pour cette tontine."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                    <th className="px-5 py-3 font-semibold">Membre</th>
                    <th className="px-3 py-3 font-semibold">Téléphone</th>
                    <th className="px-3 py-3 font-semibold">Cotisation</th>
                    <th className="px-3 py-3 font-semibold">Statut</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolled.map((m) => (
                    <tr
                      key={m.enrollmentId}
                      className="border-b border-[var(--line)] last:border-0 transition hover:bg-[#FFF8EB]/50"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1D2D50] text-xs font-bold text-[#FFCD79]">
                            {initials(m.lastName, m.firstName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--navy)]">
                              {m.lastName} {m.firstName}
                            </p>
                            <p className="truncate font-mono text-[11px] text-[var(--muted)]">
                              {m.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 tabular-nums text-[var(--muted)]">
                        {m.phone || "—"}
                      </td>
                      <td className="px-3 py-3.5 font-medium text-[var(--navy)]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{formatFcfa(m.weeklyTarget)}</span>
                          {canWrite && !m.archivedFromDirectory && filterTontineId ? (
                            <EditWeeklyTargetButton
                              periodId={filterTontineId}
                              memberId={m.id}
                              memberLabel={formatMemberShortName(m.lastName, m.firstName)}
                              currentTarget={m.weeklyTarget}
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusPill status={m.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        {canWrite ? (
                          <MemberRowActions
                            member={m}
                            archivedFromDirectory={m.archivedFromDirectory}
                            hasMemberAccount={memberIdsWithAccount.has(m.id)}
                          />
                        ) : m.archivedFromDirectory ? (
                          <span className="text-[11px] text-[var(--muted)]">Archive</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <DirectoryTable
            members={allMembers}
            enrolledAnywhereIds={enrolledAnywhereIds}
            memberIdsWithAccount={memberIdsWithAccount}
            canWrite={canWrite}
          />
        )}
      </section>
    </div>
  );
}
