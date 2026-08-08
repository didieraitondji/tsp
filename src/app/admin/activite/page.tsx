import Link from "next/link";
import {
  Activity,
  CalendarPlus,
  Handshake,
  LogIn,
  Settings,
  UserCog,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { auditRepo } from "@/lib/db/collections";
import { requireRole } from "@/lib/auth/session";

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "user", label: "Comptes" },
  { key: "member", label: "Membres" },
  { key: "loan", label: "Prêts" },
  { key: "period", label: "Tontines" },
  { key: "other", label: "Autres" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function categoryOf(action: string): FilterKey {
  if (action.startsWith("user.") || action.startsWith("auth.")) return "user";
  if (action.startsWith("member.") || action.startsWith("enrollment.")) return "member";
  if (
    action.startsWith("loan.") ||
    action.startsWith("repayment.") ||
    action.startsWith("penalty.")
  ) {
    return "loan";
  }
  if (action.startsWith("period.") || action.startsWith("settings.")) return "period";
  return "other";
}

function labelOf(action: string): string {
  const map: Record<string, string> = {
    "period.create": "Tontine créée",
    "period.close": "Tontine clôturée",
    "period.delete": "Tontine supprimée",
    "period.close_enrollments": "Inscriptions clôturées",
    "loan.create": "Prêt demandé",
    "loan.disburse": "Prêt décaissé",
    "loan.approve": "Prêt validé",
    "loan.reject": "Prêt refusé",
    "repayment.create": "Remboursement",
    "member.create": "Membre créé",
    "member.update": "Membre modifié",
    "member.enroll": "Inscription tontine",
    "user.create": "Compte créé",
    "user.update": "Compte modifié",
    "settings.update": "Paramètres mis à jour",
    "settings.loan_withdrawal_fee": "Frais de retrait modifiés",
    "penalty.create": "Pénalité créée",
    "penalty.delete": "Pénalité supprimée",
  };
  return map[action] ?? action;
}

function iconOf(action: string): LucideIcon {
  if (action.startsWith("loan.") || action.startsWith("repayment.")) return Handshake;
  if (action.startsWith("member.") || action.startsWith("enrollment.")) return Users;
  if (action.startsWith("user.")) return UserCog;
  if (action.startsWith("period.create")) return CalendarPlus;
  if (action.startsWith("period.")) return CalendarPlus;
  if (action.startsWith("settings.")) return Settings;
  if (action.startsWith("penalty.")) return Wallet;
  if (action.includes("create") && action.startsWith("member")) return UserPlus;
  if (action.startsWith("auth.")) return LogIn;
  return Activity;
}

function iconTone(action: string): string {
  const cat = categoryOf(action);
  if (cat === "loan") return "bg-amber-50 text-amber-800";
  if (cat === "member") return "bg-emerald-50 text-emerald-800";
  if (cat === "user") return "bg-sky-50 text-sky-800";
  if (cat === "period") return "bg-[#1D2D50] text-[#FFCD79]";
  return "bg-[var(--cream)] text-[var(--sand)]";
}

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function ActivitePage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  await requireRole(["SUPER_ADMIN"]);
  const sp = (await searchParams) || {};
  const filter = (FILTERS.some((f) => f.key === sp.type) ? sp.type : "all") as FilterKey;

  const audit = await auditRepo.all();
  const all = [...audit].sort((a, b) => b.at.localeCompare(a.at));
  const items = filter === "all" ? all : all.filter((a) => categoryOf(a.action) === filter);

  const today = todayIsoLocal();
  const todayCount = all.filter((a) => a.at.slice(0, 10) === today).length;
  const actors = new Set(all.map((a) => a.actorName)).size;

  const counts: Record<FilterKey, number> = {
    all: all.length,
    user: all.filter((a) => categoryOf(a.action) === "user").length,
    member: all.filter((a) => categoryOf(a.action) === "member").length,
    loan: all.filter((a) => categoryOf(a.action) === "loan").length,
    period: all.filter((a) => categoryOf(a.action) === "period").length,
    other: all.filter((a) => categoryOf(a.action) === "other").length,
  };

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
          Traçabilité
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
          Journal d’activité
        </h1>
        <p className="mt-2 max-w-xl text-[var(--muted)]">
          Historique des actions enregistrées sur la plateforme.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1D2D50] text-[#FFCD79]">
              <Activity className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Entrées
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {all.length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
              <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Aujourd’hui
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {todayCount}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-800">
              <UserCog className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Acteurs
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {actors}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[var(--navy)]">
              {items.length} événement{items.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {filter === "all" ? "Tous les types" : FILTERS.find((f) => f.key === filter)?.label}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Link
                  key={f.key}
                  href={f.key === "all" ? "/admin/activite" : `/admin/activite?type=${f.key}`}
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
                    {counts[f.key]}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--cream)] text-[var(--sand)]">
              <Activity className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <p className="mt-4 font-semibold text-[var(--navy)]">Aucune activité</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">
              Aucune entrée pour ce filtre.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {items.map((a) => {
              const Icon = iconOf(a.action);
              return (
                <li
                  key={a.id}
                  className="flex gap-3 px-5 py-4 transition hover:bg-[#FFF8EB]/50 md:px-6"
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTone(a.action)}`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[var(--navy)]">{labelOf(a.action)}</p>
                        <p className="font-mono text-[11px] text-[var(--muted)]">{a.action}</p>
                      </div>
                      <time className="shrink-0 text-xs text-[var(--muted)]">
                        {new Date(a.at).toLocaleString("fr-FR")}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      <span className="font-medium text-[var(--navy)]">{a.actorName}</span>
                      {a.details ? ` · ${a.details}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
