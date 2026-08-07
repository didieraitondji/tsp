import Link from "next/link";
import { Mail, ShieldCheck, UserCog, Users } from "lucide-react";
import { globalMembersRepo, usersRepo } from "@/lib/db/collections";
import { memberDisplayName } from "@/lib/db/domain";
import { DEFAULT_TEMP_PASSWORD } from "@/lib/auth/constants";
import { CreateUserModal } from "@/components/create-user-modal";
import { UserAccountActions } from "@/components/user-account-actions";

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "GESTIONNAIRE", label: "Gestionnaires" },
  { key: "GESTIONNAIRE_LECTURE", label: "Lecture" },
  { key: "MEMBRE", label: "Membres" },
  { key: "SUPER_ADMIN", label: "Super admin" },
] as const;

export default async function UtilisateursPage({
  searchParams,
}: {
  searchParams?: Promise<{ role?: string }>;
}) {
  const sp = (await searchParams) || {};
  const filter = sp.role || "all";
  const [users, members] = await Promise.all([usersRepo.all(), globalMembersRepo.all()]);

  const filtered = filter === "all" ? users : users.filter((u) => u.role === filter);
  const sorted = [...filtered].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      a.name.localeCompare(b.name, "fr") ||
      a.phone.localeCompare(b.phone)
  );

  const counts = {
    all: users.length,
    GESTIONNAIRE: users.filter((u) => u.role === "GESTIONNAIRE").length,
    GESTIONNAIRE_LECTURE: users.filter((u) => u.role === "GESTIONNAIRE_LECTURE").length,
    MEMBRE: users.filter((u) => u.role === "MEMBRE").length,
    SUPER_ADMIN: users.filter((u) => u.role === "SUPER_ADMIN").length,
  };

  const activeCount = users.filter((u) => u.active).length;
  const pendingPwd = users.filter((u) => u.mustChangePassword).length;
  const memberOptions = members.map((m) => ({
    id: m.id,
    label: `${m.id} — ${memberDisplayName(m)}`,
  }));

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
            Accès
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Comptes & rôles
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            MDP temporaire <span className="font-mono font-semibold">{DEFAULT_TEMP_PASSWORD}</span> —
            changement obligatoire à la 1ʳᵉ connexion.
          </p>
        </div>
        <CreateUserModal
          members={memberOptions}
          defaultRole={
            filter === "GESTIONNAIRE" ||
            filter === "GESTIONNAIRE_LECTURE" ||
            filter === "MEMBRE" ||
            filter === "SUPER_ADMIN"
              ? filter
              : "GESTIONNAIRE"
          }
        />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat icon={<Users className="h-4 w-4" />} label="Total comptes" value={users.length} />
        <Stat icon={<UserCog className="h-4 w-4" />} label="Actifs" value={activeCount} tone="emerald" />
        <Stat
          icon={<ShieldCheck className="h-4 w-4" />}
          label="MDP à changer"
          value={pendingPwd}
          tone="amber"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[var(--navy)]">
              {sorted.length} compte{sorted.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {filter === "all" ? "Tous les rôles" : FILTERS.find((f) => f.key === filter)?.label}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const count = counts[f.key as keyof typeof counts];
              return (
                <Link
                  key={f.key}
                  href={f.key === "all" ? "/admin/utilisateurs" : `/admin/utilisateurs?role=${f.key}`}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-[#1D2D50] text-[#FFCD79]"
                      : "border border-[var(--line)] text-[var(--navy)] hover:bg-[var(--cream)]"
                  }`}
                >
                  {f.label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] ${
                      active ? "bg-white/15" : "bg-[var(--cream)] text-[var(--muted)]"
                    }`}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[var(--muted)]">Aucun compte.</p>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((u) => {
              const linked = u.memberId
                ? members.find((m) => m.id === u.memberId)
                : undefined;
              return (
                <article
                  key={u.id}
                  className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--cream)]/30 p-4 transition hover:border-[#FFCD79] hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--navy)]">{u.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">{u.phone}</p>
                    </div>
                    <RoleBadge role={u.role} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {!u.active && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                        Inactif
                      </span>
                    )}
                    {u.mustChangePassword && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                        MDP temporaire
                      </span>
                    )}
                    {u.email ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] text-[var(--muted)] ring-1 ring-[var(--line)]">
                        <Mail className="h-3 w-3" />
                        {u.email}
                      </span>
                    ) : (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-[var(--muted)] ring-1 ring-[var(--line)]">
                        Pas d’email
                      </span>
                    )}
                  </div>

                  {u.memberId && (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Lié : {linked ? memberDisplayName(linked) : u.memberId}
                    </p>
                  )}

                  <UserAccountActions
                    user={{
                      id: u.id,
                      name: u.name,
                      phone: u.phone,
                      email: u.email,
                      role: u.role,
                      memberId: u.memberId,
                      active: u.active,
                    }}
                    members={memberOptions}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "emerald" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "amber"
        ? "bg-amber-50 text-amber-800"
        : "bg-[#1D2D50] text-[#FFCD79]";
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>
          {icon}
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {label}
          </p>
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles =
    role === "SUPER_ADMIN"
      ? "bg-[#1D2D50] text-[#FFCD79]"
      : role === "GESTIONNAIRE"
        ? "bg-[#FFCD79]/35 text-[#1D2D50]"
        : role === "GESTIONNAIRE_LECTURE"
          ? "bg-sky-50 text-sky-900"
          : "bg-white text-[var(--muted)] ring-1 ring-[var(--line)]";
  const label =
    role === "SUPER_ADMIN"
      ? "Super admin"
      : role === "GESTIONNAIRE"
        ? "Gestionnaire"
        : role === "GESTIONNAIRE_LECTURE"
          ? "Lecture"
          : "Membre";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${styles}`}>
      {label}
    </span>
  );
}
