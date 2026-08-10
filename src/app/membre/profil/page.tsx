import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  IdCard,
  Link2,
  Mail,
  Phone,
  Shield,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { globalMembersRepo, usersRepo } from "@/lib/db/collections";
import { listMemberTontines, memberDisplayName } from "@/lib/db/domain";
import { formatFcfa } from "@/lib/format";
import { MembreAlert } from "@/components/membre-ui";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default async function MembreProfilPage() {
  const session = await requireRole(["MEMBRE", "SUPER_ADMIN"]);
  const [users, members] = await Promise.all([
    usersRepo.all(),
    globalMembersRepo.all(),
  ]);
  const user = users.find((u) => u.id === session.user.id);
  const linked = session.user.memberId
    ? members.find((m) => m.id === session.user.memberId)
    : undefined;
  const tontines = session.user.memberId
    ? await listMemberTontines(session.user.memberId)
    : [];

  const name = session.user.name;
  const phone = session.user.phone || user?.phone || "—";
  const email = user?.email?.trim() || "Non renseigné";

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
          Compte
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--navy)]">
          Mon profil
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Identité de connexion et fiche membre associée.
        </p>
      </div>

      {!session.user.memberId && (
        <MembreAlert tone="error">
          Aucune fiche membre n’est liée à ce compte. Contactez le bureau.
        </MembreAlert>
      )}

      {/* Hero profil */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[#152238] px-5 py-6 text-[#F4E4D7] shadow-[0_20px_50px_-28px_rgba(21,34,56,0.55)] md:px-8 md:py-8">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#FFCD79]/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-[#D09C79]/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center gap-4 md:gap-5">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1D2D50] text-xl font-bold text-[#FFCD79] ring-2 ring-[#FFCD79]/35 md:h-[4.5rem] md:w-[4.5rem] md:text-2xl">
            {initials(name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFCD79]/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#FFCD79] ring-1 ring-inset ring-[#FFCD79]/35">
                <Shield className="h-3 w-3" strokeWidth={2} />
                Membre
              </span>
              {linked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-inset ring-emerald-400/30">
                  <BadgeCheck className="h-3 w-3" strokeWidth={2} />
                  Fiche liée
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white md:text-3xl">
              {name}
            </h2>
            <p className="mt-1.5 text-sm text-[#F4E4D7]/70">
              {linked ? (
                <>
                  <span className="font-mono text-[#FFCD79]/90">{linked.id}</span>
                  {" · "}
                  {memberDisplayName(linked)}
                </>
              ) : (
                "Compte sans fiche annuaire associée"
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Coordonnées */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ContactTile
          icon={Phone}
          label="Téléphone"
          value={phone}
          href={phone.startsWith("+") ? `tel:${phone}` : undefined}
        />
        <ContactTile
          icon={Mail}
          label="Email"
          value={email}
          href={email.includes("@") ? `mailto:${email}` : undefined}
        />
        <ContactTile
          icon={Shield}
          label="Accès"
          value="Espace membre"
        />
      </div>

      {/* Fiche annuaire */}
      <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_1px_0_rgba(29,45,80,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
              Fiche annuaire
            </h3>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Identité officielle utilisée par le bureau
            </p>
          </div>
          {linked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
              <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
              Synchronisée
            </span>
          ) : null}
        </div>

        <div className="p-5">
          {linked ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <DetailCard
                icon={IdCard}
                label="Identifiant"
                value={linked.id}
                mono
              />
              <DetailCard
                icon={Users}
                label="Nom sur la fiche"
                value={memberDisplayName(linked)}
              />
              <DetailCard
                icon={Phone}
                label="Téléphone fiche"
                value={linked.phone || "—"}
              />
            </div>
          ) : (
            <p className="rounded-xl bg-[var(--cream)]/50 px-4 py-8 text-center text-sm text-[var(--muted)]">
              Aucune fiche liée. Demandez au bureau d’associer votre compte.
            </p>
          )}
        </div>
      </section>

      {/* Tontines */}
      <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_1px_0_rgba(29,45,80,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
              Mes tontines
            </h3>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {tontines.length === 0
                ? "Pas encore d’inscription"
                : `${tontines.length} inscription${tontines.length > 1 ? "s" : ""}`}
            </p>
          </div>
          {tontines.length > 0 ? (
            <Link
              href="/membre"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sand)] hover:text-[var(--navy)]"
            >
              Vue d’ensemble <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
        <div className="p-5">
          {tontines.length === 0 ? (
            <p className="rounded-xl bg-[var(--cream)]/50 px-4 py-8 text-center text-sm text-[var(--muted)]">
              Vous n’êtes inscrit à aucune tontine pour le moment.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {tontines.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/membre?tontine=${encodeURIComponent(t.id)}`}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--line)] bg-gradient-to-br from-white to-[var(--cream)]/40 px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-[#FFCD79] hover:shadow-[0_14px_28px_-20px_rgba(29,45,80,0.28)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--navy)]">
                        {t.name}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--muted)]">
                        Cible {formatFcfa(t.weeklyTarget)} · {t.enrollmentStatus}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                        t.status === "active"
                          ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                          : "bg-[var(--cream)] text-[var(--muted)] ring-[var(--line)]"
                      }`}
                    >
                      {t.status === "active"
                        ? "Active"
                        : t.status === "closed"
                          ? "Clôturée"
                          : t.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function ContactTile({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1D2D50] text-[#FFCD79]">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-[var(--navy)]">
          {value}
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(29,45,80,0.04)] transition hover:-translate-y-0.5 hover:border-[#FFCD79] hover:shadow-[0_14px_28px_-20px_rgba(29,45,80,0.28)]"
      >
        {inner}
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(29,45,80,0.04)]">
      {inner}
    </div>
  );
}

function DetailCard({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--cream)]/30 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[var(--muted)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p
        className={`mt-1.5 text-sm font-semibold text-[var(--navy)] ${
          mono ? "font-mono text-[13px]" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
