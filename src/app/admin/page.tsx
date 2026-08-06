import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Shield,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { getDashboardStats } from "@/lib/db/domain";
import { auditRepo, usersRepo } from "@/lib/db/collections";
import { listPeriods } from "@/lib/db/periods";
import { formatFcfa } from "@/lib/format";
import { requireRole } from "@/lib/auth/session";

export default async function AdminDashboardPage() {
  await requireRole(["SUPER_ADMIN"]);

  const [users, stats, periods, audit] = await Promise.all([
    usersRepo.all(),
    getDashboardStats(),
    listPeriods(),
    auditRepo.all(),
  ]);

  const gestionnaires = users.filter((u) => u.role === "GESTIONNAIRE" && u.active);
  const comptesMembres = users.filter((u) => u.role === "MEMBRE" && u.active);
  const activePeriods = periods.filter((p) => p.status === "active");
  const recent = [...audit].slice(-8).reverse();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
          Vue d’ensemble
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
          Tableau de bord
        </h1>
        <p className="mt-2 max-w-xl text-[var(--muted)]">
          Pilotez les accès, les règles et l’activité. La saisie opérationnelle
          reste dans l’espace Gestion (compte gestionnaire).
          {activePeriods.length > 0
            ? ` ${activePeriods.length} tontine${activePeriods.length > 1 ? "s" : ""} active${activePeriods.length > 1 ? "s" : ""}.`
            : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<UserCog className="h-5 w-5" />}
          label="Gestionnaires"
          value={String(gestionnaires.length)}
          hint="Comptes actifs"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Comptes membres"
          value={String(comptesMembres.length)}
          hint="Accès lecture"
        />
        <StatCard
          icon={<Shield className="h-5 w-5" />}
          label="Membres tontine"
          value={String(stats.activeMembers)}
          hint="Statut actif"
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Solde caisse"
          value={formatFcfa(stats.cashBalance)}
          hint="Tontine courante"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Actions rapides
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <QuickLink
              href="/admin/utilisateurs?role=GESTIONNAIRE"
              title="Ajouter un gestionnaire"
              text="Créer un compte bureau pour saisir cotisations et prêts."
            />
            <QuickLink
              href="/admin/parametres"
              title="Règles financières"
              text="Cotisations, intérêts, pénalités et plafonds."
            />
            <QuickLink
              href="/admin/activite"
              title="Journal d’activité"
              text="Dernières actions enregistrées sur la plateforme."
            />
            <QuickLink
              href="/admin/utilisateurs?role=MEMBRE"
              title="Comptes membres"
              text="Donner un accès lecture aux membres de la tontine."
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
              Activité récente
            </h2>
            <Link
              href="/admin/activite"
              className="text-xs font-semibold text-[var(--sand)] hover:text-[var(--navy)]"
            >
              Tout voir
            </Link>
          </div>
          <ul className="mt-5 space-y-3">
            {recent.length === 0 && (
              <li className="text-sm text-[var(--muted)]">Aucune activité pour l’instant.</li>
            )}
            {recent.map((a) => (
              <li
                key={a.id}
                className="border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"
              >
                <p className="text-sm font-medium text-[var(--navy)]">{a.action}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {a.actorName}
                  {a.details ? ` · ${a.details}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-2xl bg-[#1D2D50] p-6 text-[#F4E4D7] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFCD79]">
          Deux espaces séparés
        </p>
        <p className="mt-3 max-w-2xl text-lg font-medium leading-relaxed">
          Ici, la super administration : comptes, règles et supervision. La saisie
          quotidienne (cotisations, prêts, caisse) se fait dans l’espace Gestion, après
          connexion avec un compte gestionnaire.
        </p>
        <Link
          href="/admin/utilisateurs?role=GESTIONNAIRE"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#FFCD79] px-5 py-2.5 text-sm font-semibold text-[#1D2D50] transition hover:bg-[#ffd990]"
        >
          Créer un gestionnaire
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
      <div className="flex items-center gap-2 text-[var(--sand)]">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--navy)]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function QuickLink({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-[var(--line)] bg-[var(--cream)]/60 p-4 transition hover:border-[#FFCD79] hover:bg-white"
    >
      <p className="font-semibold text-[var(--navy)] group-hover:text-[#1D2D50]">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{text}</p>
    </Link>
  );
}
