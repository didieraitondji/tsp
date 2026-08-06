import { Phone, Shield, User } from "lucide-react";
import { requireRole } from "@/lib/auth/session";

export default async function ProfilPage() {
  const session = await requireRole(["SUPER_ADMIN"]);
  const { name, phone, role } = session.user;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
          Compte
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
          Mon profil
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Informations de votre compte super administrateur.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1D2D50] text-lg font-bold text-[#FFCD79]">
            {name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0])
              .join("")
              .toUpperCase() || "SA"}
          </div>
          <div>
            <p className="font-semibold text-[var(--navy)]">{name}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--sand)]">
              {role === "SUPER_ADMIN" ? "Super admin" : role}
            </p>
          </div>
        </div>

        <dl className="mt-6 space-y-4 border-t border-[var(--line)] pt-5">
          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-4 w-4 text-[var(--sand)]" strokeWidth={1.75} />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Nom
              </dt>
              <dd className="mt-0.5 text-sm font-medium">{name}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-4 w-4 text-[var(--sand)]" strokeWidth={1.75} />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Téléphone
              </dt>
              <dd className="mt-0.5 font-mono text-sm font-medium">{phone}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 text-[var(--sand)]" strokeWidth={1.75} />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Rôle
              </dt>
              <dd className="mt-0.5 text-sm font-medium">Super administrateur</dd>
            </div>
          </div>
        </dl>

        <p className="mt-6 rounded-xl bg-[var(--cream)] px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">
          La modification du mot de passe et du numéro pourra être ajoutée plus tard. Pour
          l’instant, un autre super admin peut mettre à jour votre compte via Comptes & rôles.
        </p>
      </div>
    </div>
  );
}
