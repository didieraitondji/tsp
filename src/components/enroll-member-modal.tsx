"use client";

import { useMemo, useState } from "react";
import { UsersRound } from "lucide-react";
import { enrollMemberAction } from "@/app/actions";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label, Select } from "@/components/ui";

type DirectoryMember = {
  id: string;
  lastName: string;
  firstName: string;
};

type EnrollableTontine = {
  id: string;
  name: string;
  enrolledMemberIds: string[];
};

export function EnrollMemberModal({
  tontines,
  directoryMembers,
  contributionMin,
  defaultPeriodId,
}: {
  tontines: EnrollableTontine[];
  directoryMembers: DirectoryMember[];
  contributionMin: number;
  defaultPeriodId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const initialPeriodId =
    (defaultPeriodId && tontines.some((t) => t.id === defaultPeriodId)
      ? defaultPeriodId
      : tontines[0]?.id) || "";
  const [periodId, setPeriodId] = useState(initialPeriodId);

  const availableToEnroll = useMemo(() => {
    const tontine = tontines.find((t) => t.id === periodId);
    if (!tontine) return [];
    const enrolled = new Set(tontine.enrolledMemberIds);
    return directoryMembers.filter((m) => !enrolled.has(m.id));
  }, [tontines, directoryMembers, periodId]);

  const selectedName = tontines.find((t) => t.id === periodId)?.name;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPeriodId(initialPeriodId);
          setOpen(true);
        }}
        disabled={tontines.length === 0 || directoryMembers.length === 0}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] transition hover:border-[#FFCD79] hover:bg-[#FFF8EB] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UsersRound className="h-4 w-4" strokeWidth={1.75} />
        Inscrire à la tontine
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Inscrire à la tontine"
        description="Choisissez la tontine, puis un membre de l’annuaire pas encore inscrit à celle-ci."
      >
        {tontines.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Aucune tontine n’accepte d’inscriptions pour le moment.
          </p>
        ) : (
          <form
            action={async (fd) => {
              await enrollMemberAction(fd);
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
              <Label>Membre</Label>
              {availableToEnroll.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Tous les membres de l’annuaire sont déjà inscrits
                  {selectedName ? ` à « ${selectedName} »` : ""}.
                </p>
              ) : (
                <Select key={periodId} name="memberId" required defaultValue="">
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {availableToEnroll.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.lastName} {m.firstName}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div>
              <Label>Cotisation / sem.</Label>
              <Input name="weeklyTarget" type="number" defaultValue={contributionMin} min={0} />
            </div>
            <div>
              <Label>Statut dans la tontine</Label>
              <Select name="status" defaultValue="Actif">
                <option value="Actif">Actif</option>
                <option value="Inactif">Inactif</option>
                <option value="Suspendu">Suspendu</option>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
              >
                Annuler
              </button>
              <SubmitButton
                className="!rounded-full"
                pendingLabel="Inscription…"
                disabled={availableToEnroll.length === 0}
              >
                Inscrire
              </SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
