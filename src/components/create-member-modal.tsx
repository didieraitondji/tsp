"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { saveMemberAction } from "@/app/actions";
import { DEFAULT_TEMP_PASSWORD } from "@/lib/auth/constants";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label, Select } from "@/components/ui";
import { PhoneInput } from "@/components/phone-input";

export function CreateMemberModal({
  triggerClassName,
  triggerLabel = "Nouveau membre",
}: {
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createAccount, setCreateAccount] = useState(true);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setCreateAccount(true);
          setOpen(true);
        }}
        className={
          triggerClassName ??
          "inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1D2D50] px-4 py-2.5 text-sm font-semibold text-[#FFCD79] transition hover:bg-[#152238]"
        }
      >
        <UserPlus className="h-4 w-4" strokeWidth={1.75} />
        {triggerLabel}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau membre"
        description="Ajoute à l’annuaire global. Vous pourrez l’inscrire à une tontine ensuite."
        wide
      >
        <form
          action={async (fd) => {
            setError(null);
            if (createAccount) fd.set("createAccount", "true");
            const result = await saveMemberAction(fd);
            if (result?.error) {
              setError(result.error);
              return;
            }
            setOpen(false);
          }}
          className="space-y-3.5"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nom</Label>
              <Input name="lastName" required placeholder="HOUNGBO" />
            </div>
            <div>
              <Label>Prénoms</Label>
              <Input name="firstName" required placeholder="Afi" />
            </div>
          </div>
          <div>
            <Label>Téléphone{createAccount ? "" : " (optionnel)"}</Label>
            <PhoneInput name="phone" required={createAccount} showIcon={false} />
            <p className="mt-1 text-xs text-[var(--muted)]">+229 · 10 chiffres</p>
          </div>
          <div>
            <Label>Email</Label>
            <Input name="email" type="email" placeholder="optionnel" />
          </div>
          <div>
            <Label>Sexe</Label>
            <Select name="sex" defaultValue="">
              <option value="">—</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </Select>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--cream)]/40 px-3.5 py-3 transition hover:border-[#FFCD79]">
            <input
              type="checkbox"
              checked={createAccount}
              onChange={(e) => setCreateAccount(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--line)] accent-[#1D2D50]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--navy)]">
                Créer aussi le compte membre
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--muted)]">
                Accès espace membre · MDP temporaire{" "}
                <span className="font-mono font-semibold text-[var(--navy)]">
                  {DEFAULT_TEMP_PASSWORD}
                </span>{" "}
                (changement à la 1ʳᵉ connexion).
              </span>
            </span>
          </label>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
            >
              Annuler
            </button>
            <SubmitButton className="!rounded-full" pendingLabel="Création…">
              Créer
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
