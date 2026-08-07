import { Link2, Mail, Phone, Shield, User } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { globalMembersRepo, usersRepo } from "@/lib/db/collections";
import { memberDisplayName } from "@/lib/db/domain";
import { MembreAlert, MembrePanel } from "@/components/membre-ui";

export default async function MembreProfilPage() {
  const session = await requireRole(["MEMBRE", "SUPER_ADMIN"]);
  const [users, members] = await Promise.all([usersRepo.all(), globalMembersRepo.all()]);
  const user = users.find((u) => u.id === session.user.id);
  const linked = session.user.memberId
    ? members.find((m) => m.id === session.user.memberId)
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
          Compte
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--navy)]">
          Mon profil
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Informations de votre compte dans l’espace membre.
        </p>
      </div>

      {!session.user.memberId && (
        <MembreAlert tone="error">
          Aucune fiche membre n’est liée à ce compte. Contactez le bureau.
        </MembreAlert>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <MembrePanel title="Identité du compte">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1D2D50] text-lg font-bold text-[#FFCD79]">
              {session.user.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase() || "?"}
            </span>
            <div>
              <p className="font-semibold text-[var(--navy)]">{session.user.name}</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--sand)]">
                Membre
              </p>
            </div>
          </div>
          <dl className="mt-6 space-y-4 border-t border-[var(--line)] pt-5">
            <Info icon={<User className="h-4 w-4" />} label="Nom" value={session.user.name} />
            <Info icon={<Phone className="h-4 w-4" />} label="Téléphone" value={session.user.phone} />
            <Info
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={user?.email || "Non renseigné"}
            />
            <Info icon={<Shield className="h-4 w-4" />} label="Rôle" value="Membre" />
          </dl>
        </MembrePanel>

        <MembrePanel title="Fiche annuaire liée">
          {linked ? (
            <dl className="space-y-4">
              <Info
                icon={<Link2 className="h-4 w-4" />}
                label="Membre"
                value={memberDisplayName(linked)}
              />
              <Info icon={<User className="h-4 w-4" />} label="Identifiant" value={linked.id} />
              <Info
                icon={<Phone className="h-4 w-4" />}
                label="Téléphone fiche"
                value={linked.phone || "—"}
              />
            </dl>
          ) : (
            <p className="text-sm text-[var(--muted)]">Aucune fiche liée.</p>
          )}
        </MembrePanel>
      </div>
    </div>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-[var(--sand)]">{icon}</span>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm font-medium text-[var(--navy)]">{value}</dd>
      </div>
    </div>
  );
}
