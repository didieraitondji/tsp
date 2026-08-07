import { Mail, Phone, Shield, User } from "lucide-react";
import { roleLabel } from "@/lib/auth/permissions";
import { requireGestionAccess } from "@/lib/auth/session";
import { usersRepo } from "@/lib/db/collections";

export default async function GestionProfilPage() {
  const session = await requireGestionAccess();
  const users = await usersRepo.all();
  const user = users.find((u) => u.id === session.user.id);
  const { name, phone, role } = session.user;

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8 max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">Compte</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
          Mon profil
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Informations de votre compte dans l’espace gestion.
        </p>
      </div>

      <div className="max-w-xl rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1D2D50] text-lg font-bold text-[#FFCD79]">
            {name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0])
              .join("")
              .toUpperCase() || "?"}
          </div>
          <div>
            <p className="font-semibold text-[var(--navy)]">{name}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--sand)]">
              {roleLabel(role)}
            </p>
          </div>
        </div>

        <dl className="mt-6 space-y-4 border-t border-[var(--line)] pt-5">
          <Info icon={<User className="h-4 w-4" />} label="Nom" value={name} />
          <Info icon={<Phone className="h-4 w-4" />} label="Téléphone" value={phone} />
          <Info
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            value={user?.email || "Non renseigné"}
          />
          <Info icon={<Shield className="h-4 w-4" />} label="Rôle" value={roleLabel(role)} />
        </dl>
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
        <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-[var(--navy)]">{value}</dd>
      </div>
    </div>
  );
}
