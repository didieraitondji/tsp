"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { createCashEntryAction } from "@/app/actions";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label, Select } from "@/components/ui";

type TontineOption = { id: string; name: string };

export function CreateCashEntryModal({
  tontines,
  defaultPeriodId,
}: {
  tontines: TontineOption[];
  defaultPeriodId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const initialPeriodId =
    (defaultPeriodId && tontines.some((t) => t.id === defaultPeriodId)
      ? defaultPeriodId
      : tontines[0]?.id) || "";
  const [periodId, setPeriodId] = useState(initialPeriodId);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPeriodId(initialPeriodId);
          setOpen(true);
        }}
        disabled={tontines.length === 0}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1D2D50] px-4 py-2.5 text-sm font-semibold text-[#FFCD79] transition hover:bg-[#152238] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Wallet className="h-4 w-4" strokeWidth={1.75} />
        Nouvelle écriture
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouvelle écriture"
        description="Ajoutez une entrée ou une sortie manuelle à la caisse de la tontine."
      >
        {tontines.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Aucune tontine disponible.</p>
        ) : (
          <form
            action={async (fd) => {
              await createCashEntryAction(fd);
              setOpen(false);
            }}
            className="space-y-3.5"
          >
            <div>
              <Label>Tontine</Label>
              <Select
                name="periodId"
                required
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                {tontines.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input name="date" type="date" required />
            </div>
            <div>
              <Label>Type</Label>
              <Select name="type" defaultValue="Entrée">
                <option value="Entrée">Entrée</option>
                <option value="Sortie">Sortie</option>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input name="description" required />
            </div>
            <div>
              <Label>Montant (FCFA)</Label>
              <Input name="amount" type="number" min={1} required />
            </div>
            <div>
              <Label>Référence</Label>
              <Input name="reference" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
              >
                Annuler
              </button>
              <SubmitButton className="!rounded-full" pendingLabel="Enregistrement…">
                Enregistrer
              </SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
