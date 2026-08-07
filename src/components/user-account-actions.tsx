"use client";

import { useState } from "react";
import {
  KeyRound,
  Link2,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Power,
  Trash2,
} from "lucide-react";
import { deleteUserAction, updateUserAction } from "@/app/actions";
import { DEFAULT_TEMP_PASSWORD } from "@/lib/auth/constants";
import { Modal } from "@/components/modal";
import { PasswordInput } from "@/components/password-input";
import { PhoneInput } from "@/components/phone-input";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label, Select } from "@/components/ui";
import type { Role, User } from "@/lib/types";

type MemberOption = {
  id: string;
  label: string;
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function roleMeta(role: Role): { label: string; accent: string; avatar: string } {
  switch (role) {
    case "SUPER_ADMIN":
      return {
        label: "Super admin",
        accent: "bg-[#1D2D50]",
        avatar: "bg-[#1D2D50] text-[#FFCD79]",
      };
    case "GESTIONNAIRE":
      return {
        label: "Gestionnaire",
        accent: "bg-[#D09C79]",
        avatar: "bg-[#FFCD79]/40 text-[#1D2D50]",
      };
    case "GESTIONNAIRE_LECTURE":
      return {
        label: "Lecture",
        accent: "bg-sky-500",
        avatar: "bg-sky-50 text-sky-900",
      };
    default:
      return {
        label: "Membre",
        accent: "bg-[var(--muted)]",
        avatar: "bg-[var(--cream)] text-[var(--navy)]",
      };
  }
}

export function UserAccountCard({
  user,
  linkedMemberLabel,
  members,
}: {
  user: Pick<
    User,
    "id" | "name" | "phone" | "email" | "role" | "memberId" | "active" | "mustChangePassword"
  >;
  linkedMemberLabel?: string | null;
  members: MemberOption[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const meta = roleMeta(user.role);

  return (
    <>
      <article
        className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_0_rgba(29,45,80,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-18px_rgba(29,45,80,0.35)] ${
          user.active
            ? "border-[var(--line)] hover:border-[#FFCD79]"
            : "border-red-200/80 opacity-80"
        }`}
      >
        <span className={`absolute inset-y-0 left-0 w-1 ${meta.accent}`} aria-hidden />

        <div className="flex flex-1 flex-col p-4 pl-5">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${meta.avatar}`}
            >
              {initials(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--navy)]">{user.name}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--sand)]">
                    {meta.label}
                  </p>
                </div>
                {!user.active && (
                  <span className="shrink-0 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                    Inactif
                  </span>
                )}
              </div>
            </div>
          </div>

          <dl className="mt-4 space-y-2.5 border-t border-[var(--line)]/70 pt-3.5">
            <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Téléphone">
              <span className="font-mono tabular-nums">{user.phone}</span>
            </InfoRow>
            <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email">
              {user.email || <span className="text-[var(--muted)]">Non renseigné</span>}
            </InfoRow>
            <InfoRow icon={<Link2 className="h-3.5 w-3.5" />} label="Membre lié">
              {linkedMemberLabel || <span className="text-[var(--muted)]">Aucun</span>}
            </InfoRow>
          </dl>

          {user.mustChangePassword && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-900">
              <KeyRound className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              Mot de passe temporaire à changer
            </p>
          )}

          <div className="mt-auto flex items-center gap-1.5 border-t border-[var(--line)]/70 pt-3">
            <button
              type="button"
              onClick={() => {
                setRole(user.role);
                setError(null);
                setEditOpen(true);
              }}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#1D2D50] px-3 py-2 text-xs font-semibold text-[#FFCD79] transition hover:bg-[#152238]"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              Modifier
            </button>
            <button
              type="button"
              disabled={toggling}
              title={user.active ? "Désactiver" : "Réactiver"}
              aria-label={user.active ? "Désactiver" : "Réactiver"}
              onClick={() => {
                setError(null);
                setToggleOpen(true);
              }}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[var(--line)] text-[var(--muted)] transition hover:border-[var(--navy)] hover:bg-[var(--cream)] hover:text-[var(--navy)] disabled:cursor-wait disabled:opacity-60"
            >
              <Power className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              title="Supprimer"
              aria-label="Supprimer"
              onClick={() => {
                setError(null);
                setDeleteOpen(true);
              }}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[var(--line)] text-[var(--muted)] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </article>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier le compte"
        description={user.name}
      >
        <form
          action={async (fd) => {
            setError(null);
            const result = await updateUserAction(fd);
            if (result?.error) {
              setError(result.error);
              return;
            }
            setEditOpen(false);
          }}
          className="space-y-3.5"
        >
          <input type="hidden" name="id" value={user.id} />
          <div>
            <Label>Nom complet</Label>
            <Input name="name" required defaultValue={user.name} />
          </div>
          <div>
            <Label>Téléphone</Label>
            <PhoneInput name="phone" required showIcon={false} defaultValue={user.phone} />
            <p className="mt-1 text-xs text-[var(--muted)]">+229 · 10 chiffres</p>
          </div>
          <div>
            <Label>Email (optionnel)</Label>
            <Input
              name="email"
              type="email"
              defaultValue={user.email || ""}
              placeholder="vous@exemple.com"
            />
          </div>
          <div>
            <Label>Rôle</Label>
            <Select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="GESTIONNAIRE">Gestionnaire</option>
              <option value="GESTIONNAIRE_LECTURE">Gestionnaire lecture</option>
              <option value="MEMBRE">Membre</option>
              <option value="SUPER_ADMIN">Super admin</option>
            </Select>
          </div>
          <div>
            <Label>Membre lié{role === "MEMBRE" ? "" : " (optionnel)"}</Label>
            <Select
              name="memberId"
              required={role === "MEMBRE"}
              defaultValue={user.memberId || ""}
            >
              <option value="" disabled={role === "MEMBRE"}>
                {role === "MEMBRE" ? "Choisir…" : "Aucun"}
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
            {members.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-800">
                Aucun membre dans l’annuaire — créez-en un dans Gestion → Membres.
              </p>
            )}
          </div>
          <div>
            <Label>Réinitialiser le mot de passe (optionnel)</Label>
            <PasswordInput
              name="password"
              minLength={6}
              autoComplete="new-password"
              placeholder={`Ex. ${DEFAULT_TEMP_PASSWORD}`}
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Si renseigné, l’utilisateur devra le changer à la prochaine connexion.
            </p>
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
            >
              Annuler
            </button>
            <SubmitButton className="!rounded-full" pendingLabel="Enregistrement…">
              Enregistrer
            </SubmitButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={toggleOpen}
        onClose={() => !toggling && setToggleOpen(false)}
        title={user.active ? "Désactiver le compte" : "Réactiver le compte"}
        description={
          user.active
            ? "Le compte ne pourra plus se connecter tant qu’il reste désactivé."
            : "Le compte pourra de nouveau se connecter."
        }
      >
        <p className="text-sm text-[var(--muted)]">
          Confirmer {user.active ? "la désactivation" : "la réactivation"} de{" "}
          <strong className="text-[var(--navy)]">{user.name}</strong> ({user.phone}) ?
        </p>
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={toggling}
            onClick={() => setToggleOpen(false)}
            className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={toggling}
            onClick={async () => {
              setToggling(true);
              setError(null);
              try {
                const fd = new FormData();
                fd.set("id", user.id);
                fd.set("active", user.active ? "false" : "true");
                const result = await updateUserAction(fd);
                if (result?.error) {
                  setError(result.error);
                  return;
                }
                setToggleOpen(false);
              } finally {
                setToggling(false);
              }
            }}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-60 ${
              user.active
                ? "bg-red-700 hover:bg-red-800"
                : "bg-[#1D2D50] hover:bg-[#152238]"
            }`}
          >
            {toggling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                {user.active ? "Désactivation…" : "Réactivation…"}
              </>
            ) : user.active ? (
              "Désactiver"
            ) : (
              "Réactiver"
            )}
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title="Supprimer le compte"
        description="Cette action est définitive."
      >
        <p className="text-sm text-[var(--muted)]">
          Confirmer la suppression de{" "}
          <strong className="text-[var(--navy)]">{user.name}</strong> ({user.phone}) ?
        </p>
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={deleting}
            onClick={() => setDeleteOpen(false)}
            className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              setError(null);
              try {
                const fd = new FormData();
                fd.set("id", user.id);
                const result = await deleteUserAction(fd);
                if (result?.error) {
                  setError(result.error);
                  return;
                }
                setDeleteOpen(false);
              } finally {
                setDeleting(false);
              }
            }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                Suppression…
              </>
            ) : (
              "Supprimer"
            )}
          </button>
        </div>
      </Modal>
    </>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 text-[var(--sand)]" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="sr-only">{label}</dt>
        <dd className="truncate text-[var(--navy)]">{children}</dd>
      </div>
    </div>
  );
}
