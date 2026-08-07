"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { deleteUserAction, updateUserAction } from "@/app/actions";
import { DEFAULT_TEMP_PASSWORD } from "@/lib/auth/constants";
import { Modal } from "@/components/modal";
import { PasswordInput } from "@/components/password-input";
import { PhoneInput } from "@/components/phone-input";
import { SubmitButton } from "@/components/submit-button";
import { Button, Input, Label, Select } from "@/components/ui";
import type { Role, User } from "@/lib/types";

type MemberOption = {
  id: string;
  label: string;
};

export function UserAccountActions({
  user,
  members,
}: {
  user: Pick<
    User,
    "id" | "name" | "phone" | "email" | "role" | "memberId" | "active"
  >;
  members: MemberOption[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  return (
    <>
      <div className="mt-auto space-y-2 border-t border-[var(--line)] pt-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setRole(user.role);
              setError(null);
              setEditOpen(true);
            }}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--cream)]"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            Modifier
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setDeleteOpen(true);
            }}
            className="inline-flex cursor-pointer items-center justify-center rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
            title="Supprimer"
            aria-label="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
        <Button
          type="button"
          variant={user.active ? "danger" : "secondary"}
          disabled={toggling}
          className="!w-full !rounded-full !px-3 !py-1.5 text-xs"
          onClick={async () => {
            setToggling(true);
            try {
              const fd = new FormData();
              fd.set("id", user.id);
              fd.set("active", user.active ? "false" : "true");
              await updateUserAction(fd);
            } finally {
              setToggling(false);
            }
          }}
        >
          {toggling ? "…" : user.active ? "Désactiver" : "Réactiver"}
        </Button>
      </div>

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
          {role === "MEMBRE" && (
            <div>
              <Label>Membre lié</Label>
              <Select name="memberId" required defaultValue={user.memberId || ""}>
                <option value="" disabled>
                  Choisir…
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
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
