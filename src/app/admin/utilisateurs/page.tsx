import Link from "next/link";
import { UserPlus, ShieldCheck, UserCog, Users } from "lucide-react";
import { globalMembersRepo, usersRepo } from "@/lib/db/collections";
import { createUserAction, updateUserAction } from "@/app/actions";
import { memberDisplayName } from "@/lib/db/domain";
import { Button, Input, Label, Select } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { PhoneInput } from "@/components/phone-input";

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

  const filtered =
    filter === "all" ? users : users.filter((u) => u.role === filter);

  const counts = {
    all: users.length,
    GESTIONNAIRE: users.filter((u) => u.role === "GESTIONNAIRE").length,
    GESTIONNAIRE_LECTURE: users.filter((u) => u.role === "GESTIONNAIRE_LECTURE").length,
    MEMBRE: users.filter((u) => u.role === "MEMBRE").length,
    SUPER_ADMIN: users.filter((u) => u.role === "SUPER_ADMIN").length,
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
            Accès
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            Comptes & rôles
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Créez des gestionnaires pour le bureau, et des comptes membres en lecture seule.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = counts[f.key as keyof typeof counts];
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/admin/utilisateurs" : `/admin/utilisateurs?role=${f.key}`}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[#1D2D50] text-[#F4E4D7]"
                  : "bg-white text-[var(--muted)] ring-1 ring-[var(--line)] hover:text-[var(--navy)]"
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 text-xs ${
                  active ? "bg-white/15" : "bg-[var(--cream)]"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <h2 className="font-semibold text-[var(--navy)]">
              {filtered.length} compte{filtered.length > 1 ? "s" : ""}
            </h2>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {filtered.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
                Aucun compte dans ce filtre.
              </p>
            )}
            {filtered.map((u) => (
              <article key={u.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--navy)]">{u.name}</p>
                      <RoleBadge role={u.role} />
                      {!u.active && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                          Inactif
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-xs text-[var(--muted)]">{u.phone}</p>
                    {u.memberId && (
                      <p className="mt-1 text-xs text-[var(--muted)]">Lié à {u.memberId}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={updateUserAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <Select name="role" defaultValue={u.role} className="!w-auto !rounded-full !py-1.5 text-xs">
                      <option value="SUPER_ADMIN">Super admin</option>
                      <option value="GESTIONNAIRE">Gestionnaire</option>
                      <option value="GESTIONNAIRE_LECTURE">Gestionnaire lecture</option>
                      <option value="MEMBRE">Membre</option>
                    </Select>
                    <Select
                      name="memberId"
                      defaultValue={u.memberId || ""}
                      className="!w-auto !rounded-full !py-1.5 text-xs"
                    >
                      <option value="">Membre lié —</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="secondary" className="!rounded-full !px-3 !py-1.5 text-xs">
                      Enregistrer
                    </Button>
                  </form>
                  <form action={updateUserAction}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                    <Button
                      type="submit"
                      variant={u.active ? "danger" : "secondary"}
                      className="!rounded-full !px-3 !py-1.5 text-xs"
                    >
                      {u.active ? "Désactiver" : "Réactiver"}
                    </Button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="h-fit rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6">
          <div className="flex items-center gap-2 text-[var(--sand)]">
            <UserPlus className="h-5 w-5" strokeWidth={1.75} />
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">Nouveau compte</p>
          </div>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold">
            Créer un utilisateur
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Priorité : comptes <strong>Gestionnaire</strong> pour le bureau.
          </p>

          <form action={createUserAction} className="mt-5 space-y-4">
            <div>
              <Label>Nom complet</Label>
              <Input name="name" required placeholder="Ex. Trésorier principal" />
            </div>
            <div>
              <Label>Téléphone</Label>
              <PhoneInput name="phone" required showIcon={false} />
              <p className="mt-1 text-xs text-[var(--muted)]">+229 · 10 chiffres</p>
            </div>
            <div>
              <Label>Mot de passe</Label>
              <PasswordInput name="password" required minLength={6} autoComplete="new-password" />
            </div>
            <div>
              <Label>Rôle</Label>
              <Select name="role" defaultValue="GESTIONNAIRE">
                <option value="GESTIONNAIRE">Gestionnaire</option>
                <option value="GESTIONNAIRE_LECTURE">Gestionnaire lecture</option>
                <option value="MEMBRE">Membre</option>
                <option value="SUPER_ADMIN">Super admin</option>
              </Select>
            </div>
            <div>
              <Label>Membre lié (si rôle Membre)</Label>
              <Select name="memberId" defaultValue="">
                <option value="">—</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id} — {memberDisplayName(m)}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" className="w-full !rounded-full">
              Créer le compte
            </Button>
          </form>

          <ul className="mt-6 space-y-2 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)]">
            <li className="flex gap-2">
              <UserCog className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--sand)]" />
              Gestionnaire : saisie cotisations, prêts, caisse.
            </li>
            <li className="flex gap-2">
              <UserCog className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--sand)]" />
              Gestionnaire lecture : consultation + confirmation des prêts (pas de modification).
            </li>
            <li className="flex gap-2">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--sand)]" />
              Membre : consultation uniquement de son dossier.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--sand)]" />
              Super admin : droits complets (à utiliser avec parcimonie).
            </li>
          </ul>
        </section>
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
          : "bg-[var(--cream)] text-[var(--muted)]";
  const label =
    role === "SUPER_ADMIN"
      ? "Super admin"
      : role === "GESTIONNAIRE"
        ? "Gestionnaire"
        : role === "GESTIONNAIRE_LECTURE"
          ? "Lecture"
          : "Membre";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles}`}>
      {label}
    </span>
  );
}
