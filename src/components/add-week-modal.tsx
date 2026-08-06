"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { addWeekAction } from "@/app/actions";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label } from "@/components/ui";

export function AddWeekModal({
  periodId,
  tontineName,
}: {
  periodId: string;
  tontineName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:border-[#FFCD79] hover:bg-[#FFF8EB]"
      >
        <CalendarPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
        Ajouter une séance
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ajouter une séance"
        description={`Ajoute une date de cotisation à « ${tontineName} » (secours si la date n’est pas dans le calendrier généré).`}
      >
        <form
          action={async (fd) => {
            await addWeekAction(fd);
            setOpen(false);
          }}
          className="space-y-3.5"
        >
          <input type="hidden" name="periodId" value={periodId} />
          <div>
            <Label>Date</Label>
            <Input name="date" type="date" required />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
            >
              Annuler
            </button>
            <SubmitButton className="!rounded-full" pendingLabel="Ajout…">
              Ajouter
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
