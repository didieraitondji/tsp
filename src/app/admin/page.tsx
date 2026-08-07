import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Scale,
  Shield,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { getDashboardStats } from "@/lib/db/domain";
import { auditRepo, usersRepo } from "@/lib/db/collections";
import { listPeriods } from "@/lib/db/periods";
import { formatDate, formatFcfa } from "@/lib/format";
import { requireRole } from "@/lib/auth/session";

export default async function AdminDashboardPage() {
  await requireRole(["SUPER_ADMIN"]);

  const [users, stats, periods, audit] = await Promise.all([
    usersRepo.all(),
    getDashboardStats(),
    listPeriods(),
    auditRepo.all(),
  ]);

  const gestionnaires = users.filter(
    (u) => (u.role === "GESTIONNAIRE" || u.role === "GESTIONNAIRE_LECTURE") && u.active
  );
  const comptesMembres = users.filter((u) => u.role === "MEMBRE" && u.active);
  const activePeriods = periods.filter((p) => p.status === "active");
  const recent = [...audit].slice(-8).reverse();

  const quickActions = [
    {
      href: "/admin/utilisateurs?role=GESTIONNAIRE",
      title: "Ajouter un gestionnaire",
      text: "Compte bureau pour cotisations, prêts et validations.",
      icon: UserCog,
    },
    {
      href: "/admin/parametres",
      title: "Règles financières",
      text: "Cotisations, intérêts, frais de retrait, pénalités.",
      icon: Scale,
    },
    {
      href: "/admin/activite",
      title: "Journal d’activité",
      text: "Dernières actions enregistrées sur la plateforme.",
      icon: Activity,
    },
    {
      href: "/admin/utilisateurs?role=MEMBRE",
      title: "Comptes membres",
      text: "Accès lecture pour les membres de la tontine.",
      icon: BookOpen,
    },
  ];

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
            Vue d’ensemble
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Tableau de bord
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Pilotez les accès, les règles et l’activité. La saisie quotidienne reste dans
            l’espace Gestion.
            {activePeriods.length > 0
              ? ` ${activePeriods.length} tontine${activePeriods.length > 1 ? "s" : ""} active${activePeriods.length > 1 ? "s" : ""}.`
              : ""}
          </p>
        </div>
        <Link
          href="/gestion"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-[#1D2D50] px-4 py-2.5 text-sm font-semibold text-[#FFCD79] transition hover:bg-[#152238]"
        >
          Ouvrir l’espace gestion
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-800">
              <UserCog className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Gestionnaires
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {gestionnaires.length}
              </p>
              <p className="text-[11px] text-[var(--muted)]">Comptes actifs</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--cream)] text-[var(--sand)]">
              <Users className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Comptes membres
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {comptesMembres.length}
              </p>
              <p className="text-[11px] text-[var(--muted)]">Accès lecture</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
              <Shield className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Membres tontine
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
                {stats.activeMembers}
              </p>
              <p className="text-[11px] text-[var(--muted)]">Statut actif</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1D2D50] text-[#FFCD79]">
              <Wallet className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Solde caisse
              </p>
              <p
                className={`font-[family-name:var(--font-display)] text-xl font-bold ${
                  stats.cashBalance < 0 ? "text-red-700" : "text-[var(--navy)]"
                }`}
              >
                {formatFcfa(stats.cashBalance)}
              </p>
              <p className="text-[11px] text-[var(--muted)]">Tontine courante</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <p className="text-sm font-semibold text-[var(--navy)]">Actions rapides</p>
            <p className="text-xs text-[var(--muted)]">Accès directs à la configuration</p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {quickActions.map((item) => {
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
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-[var(--navy)]">Activité récente</p>
              <p className="text-xs text-[var(--muted)]">Dernières actions audit</p>
            </div>
            <Link
              href="/admin/activite"
              className="text-xs font-semibold text-[var(--sand)] transition hover:text-[var(--navy)]"
            >
              Tout voir
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
              Aucune activité pour l’instant.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {recent.map((a) => (
                <li key={a.id} className="px-5 py-3.5 transition hover:bg-[#FFF8EB]/50">
                  <p className="text-sm font-medium text-[var(--navy)]">{a.action}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {a.actorName}
                    {a.details ? ` · ${a.details}` : ""}
                    {a.at ? ` · ${formatDate(a.at.slice(0, 10))}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl bg-[#1D2D50] px-5 py-6 text-[#F4E4D7] md:px-8 md:py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFCD79]">
          Deux espaces séparés
        </p>
        <p className="mt-3 max-w-2xl text-lg font-medium leading-relaxed">
          Ici, la super administration : comptes, règles et supervision. La saisie quotidienne
          (cotisations, prêts, caisse) se fait dans l’espace Gestion.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/admin/utilisateurs?role=GESTIONNAIRE"
            className="inline-flex items-center gap-2 rounded-full bg-[#FFCD79] px-5 py-2.5 text-sm font-semibold text-[#1D2D50] transition hover:bg-[#ffd990]"
          >
            Créer un gestionnaire
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <Link
            href="/admin/parametres"
            className="inline-flex items-center gap-2 rounded-full border border-[#FFCD79]/40 px-5 py-2.5 text-sm font-semibold text-[#FFCD79] transition hover:bg-white/5"
          >
            Voir les règles
          </Link>
        </div>
      </section>
    </div>
  );
}
