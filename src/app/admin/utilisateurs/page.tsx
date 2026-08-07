import Link from "next/link";
import { ShieldCheck, UserCog, Users } from "lucide-react";
import { globalMembersRepo, usersRepo } from "@/lib/db/collections";
import { memberDisplayName } from "@/lib/db/domain";
import { DEFAULT_TEMP_PASSWORD } from "@/lib/auth/constants";
import { CreateUserModal } from "@/components/create-user-modal";
import { UsersAccountsBrowser } from "@/components/users-accounts-browser";

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

  const cards = sorted.map((u) => {
    const linked = u.memberId ? members.find((m) => m.id === u.memberId) : undefined;
    return {
      id: u.id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      role: u.role,
      memberId: u.memberId,
      active: u.active,
      mustChangePassword: u.mustChangePassword,
      linkedMemberLabel: linked ? memberDisplayName(linked) : u.memberId,
    };
  });

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

        <UsersAccountsBrowser users={cards} members={memberOptions} />
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
