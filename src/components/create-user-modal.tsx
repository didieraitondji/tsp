"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { createUserAction } from "@/app/actions";
import { DEFAULT_TEMP_PASSWORD } from "@/lib/auth/constants";
import { Modal } from "@/components/modal";
import { PhoneInput } from "@/components/phone-input";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label, Select } from "@/components/ui";

type MemberOption = {
  id: string;
  label: string;
};

export function CreateUserModal({
  members,
  defaultRole = "GESTIONNAIRE",
}: {
  members: MemberOption[];
  defaultRole?: string;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(defaultRole);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRole(defaultRole);
          setOpen(true);
        }}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1D2D50] px-4 py-2.5 text-sm font-semibold text-[#FFCD79] transition hover:bg-[#152238]"
      >
        <UserPlus className="h-4 w-4" strokeWidth={1.75} />
        Nouveau compte
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau compte"
        description={`Mot de passe temporaire : ${DEFAULT_TEMP_PASSWORD}. L’utilisateur devra le changer à la première connexion.`}
      >
        <form
          action={async (fd) => {
            await createUserAction(fd);
            setOpen(false);
          }}
          className="space-y-3.5"
        >
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
            <Label>Email (optionnel)</Label>
            <Input name="email" type="email" placeholder="vous@exemple.com" />
          </div>
          <div>
            <Label>Rôle</Label>
            <Select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="GESTIONNAIRE">Gestionnaire</option>
              <option value="GESTIONNAIRE_LECTURE">Gestionnaire lecture</option>
              <option value="MEMBRE">Membre</option>
              <option value="SUPER_ADMIN">Super admin</option>
            </Select>
          </div>
          {role === "MEMBRE" && (
            <div>
              <Label>Membre lié</Label>
              <Select name="memberId" required defaultValue="">
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
          <p className="rounded-xl bg-[var(--cream)]/60 px-3 py-2.5 text-[11px] leading-relaxed text-[var(--muted)]">
            MDP initial{" "}
            <span className="font-mono font-semibold text-[var(--navy)]">{DEFAULT_TEMP_PASSWORD}</span>{" "}
            — changement obligatoire à la 1ʳᵉ connexion.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
            >
              Annuler
            </button>
            <SubmitButton className="!rounded-full" pendingLabel="Création…">
              Créer le compte
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
