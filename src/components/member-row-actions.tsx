"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { deleteMemberAction, saveMemberAction } from "@/app/actions";
import { DEFAULT_TEMP_PASSWORD } from "@/lib/auth/constants";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label, Select } from "@/components/ui";
import { PhoneInput } from "@/components/phone-input";
import type { Member } from "@/lib/types";

export function MemberRowActions({
  member,
  archivedFromDirectory,
  hasMemberAccount = false,
}: {
  member: Member;
  archivedFromDirectory?: boolean;
  /** True si un compte utilisateur (rôle MEMBRE) est déjà lié. */
  hasMemberAccount?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createAccount, setCreateAccount] = useState(false);

  if (archivedFromDirectory) {
    return (
      <span
        className="inline-flex rounded-full bg-[var(--cream)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] ring-1 ring-inset ring-[var(--line)]"
        title="Retiré de l’annuaire — trace conservée sur la tontine"
      >
        Archive
      </span>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setCreateAccount(false);
            setEditOpen(true);
          }}
          className="inline-flex cursor-pointer items-center justify-center rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--cream)] hover:text-[var(--navy)]"
          title="Modifier"
          aria-label="Modifier"
        >
          <Pencil className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="inline-flex cursor-pointer items-center justify-center rounded-lg p-2 text-[var(--muted)] transition hover:bg-red-50 hover:text-red-700"
          title="Supprimer"
          aria-label="Supprimer"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier le membre"
        description={`${member.lastName} ${member.firstName}`}
        wide
      >
        <form
          action={async (fd) => {
            setError(null);
            if (!hasMemberAccount && createAccount) fd.set("createAccount", "true");
            const result = await saveMemberAction(fd);
            if (result?.error) {
              setError(result.error);
              return;
            }
            setEditOpen(false);
          }}
          className="space-y-3.5"
        >
          <input type="hidden" name="id" value={member.id} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nom</Label>
              <Input name="lastName" required defaultValue={member.lastName} />
            </div>
            <div>
              <Label>Prénoms</Label>
              <Input name="firstName" required defaultValue={member.firstName} />
            </div>
          </div>
          <div>
            <Label>
              Téléphone
              {!hasMemberAccount && createAccount ? "" : " (optionnel)"}
            </Label>
            <PhoneInput
              name="phone"
              required={!hasMemberAccount && createAccount}
              showIcon={false}
              defaultValue={member.phone}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">+229 · 10 chiffres</p>
          </div>
          <div>
            <Label>Email</Label>
            <Input name="email" type="email" defaultValue={member.email || ""} placeholder="optionnel" />
          </div>
          <div>
            <Label>Sexe</Label>
            <Select name="sex" defaultValue={member.sex || ""}>
              <option value="">—</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </Select>
          </div>

          {!hasMemberAccount ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--cream)]/40 px-3.5 py-3 transition hover:border-[#FFCD79]">
              <input
                type="checkbox"
                checked={createAccount}
                onChange={(e) => setCreateAccount(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--line)] accent-[#1D2D50]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--navy)]">
                  Créer le compte membre
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--muted)]">
                  Nécessite un téléphone · MDP temporaire{" "}
                  <span className="font-mono font-semibold text-[var(--navy)]">
                    {DEFAULT_TEMP_PASSWORD}
                  </span>{" "}
                  (changement à la 1ʳᵉ connexion).
                </span>
              </span>
            </label>
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900">
              Un compte membre est déjà lié : le téléphone, le nom et l’email de
              connexion seront mis à jour avec cette fiche.
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
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
        title="Retirer de l’annuaire"
        description="Le membre disparaît de l’annuaire. S’il est inscrit à des tontines, une copie est conservée sur chacune pour l’historique."
      >
        <p className="text-sm text-[var(--muted)]">
          Confirmer le retrait de{" "}
          <strong className="text-[var(--navy)]">
            {member.lastName} {member.firstName}
          </strong>{" "}
          ({member.id}) ?
        </p>
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
              try {
                const fd = new FormData();
                fd.set("memberId", member.id);
                await deleteMemberAction(fd);
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
              "Retirer de l’annuaire"
            )}
          </button>
        </div>
      </Modal>
    </>
  );
}
