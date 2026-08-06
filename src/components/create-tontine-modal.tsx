"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { createPeriodAction } from "@/app/actions";
import { Modal } from "@/components/modal";
import { PeriodicityFields } from "@/components/periodicity-fields";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label } from "@/components/ui";

export function CreateTontineModal({
  triggerClassName,
  triggerLabel = "Créer une tontine",
  redirectTo = "/gestion/membres",
}: {
  triggerClassName?: string;
  triggerLabel?: string;
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:border-[#FFCD79] hover:bg-[#FFF8EB]"
        }
      >
        <CalendarPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
        {triggerLabel}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouvelle tontine"
        description="Définit les dates et la périodicité, génère le calendrier, et sélectionne ce cycle pour le travail courant. Les autres tontines actives restent inchangées."
        wide
      >
        <form action={createPeriodAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="sm:col-span-2">
            <Label>Nom</Label>
            <Input name="name" required placeholder="Tontine 2027" />
          </div>
          <div>
            <Label>Date de début</Label>
            <Input name="startDate" type="date" required />
          </div>
          <div>
            <Label>Date de fin</Label>
            <Input name="endDate" type="date" required />
          </div>
          <PeriodicityFields />
          <div className="flex justify-end gap-2 sm:col-span-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
            >
              Annuler
            </button>
            <SubmitButton className="!rounded-full" pendingLabel="Création…">
              Créer et sélectionner
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
