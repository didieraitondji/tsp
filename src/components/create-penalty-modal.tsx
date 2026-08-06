"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { createPenaltyAction } from "@/app/actions";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label, Select } from "@/components/ui";
import { formatFcfa } from "@/lib/format";

type MemberOption = {
  id: string;
  label: string;
};

type PenaltyTontine = {
  id: string;
  name: string;
  members: MemberOption[];
  penaltyLateContribution: number;
  penaltyAbsence: number;
};

const MOTIF_OPTIONS = [
  { value: "retard_cotisation", label: "Retard cotisation" },
  { value: "absence_reunion", label: "Absence réunion" },
  { value: "autre", label: "Autre" },
] as const;

export function CreatePenaltyModal({
  tontines,
  defaultPeriodId,
}: {
  tontines: PenaltyTontine[];
  defaultPeriodId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const initialPeriodId =
    (defaultPeriodId && tontines.some((t) => t.id === defaultPeriodId)
      ? defaultPeriodId
      : tontines[0]?.id) || "";
  const [periodId, setPeriodId] = useState(initialPeriodId);
  const [motif, setMotif] = useState<(typeof MOTIF_OPTIONS)[number]["value"]>("retard_cotisation");

  const selected = useMemo(
    () => tontines.find((t) => t.id === periodId) ?? null,
    [tontines, periodId]
  );
  const members = selected?.members ?? [];
  const motifLabelDefault =
    MOTIF_OPTIONS.find((m) => m.value === motif)?.label ?? "Autre";

  const hint =
    motif === "retard_cotisation"
      ? `Défaut : ${formatFcfa(selected?.penaltyLateContribution ?? 0)}`
      : motif === "absence_reunion"
        ? `Défaut : ${formatFcfa(selected?.penaltyAbsence ?? 0)}`
        : "Saisir un montant";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPeriodId(initialPeriodId);
          setMotif("retard_cotisation");
          setOpen(true);
        }}
        disabled={tontines.length === 0}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1D2D50] px-4 py-2.5 text-sm font-semibold text-[#FFCD79] transition hover:bg-[#152238] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
        Nouvelle pénalité
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouvelle pénalité"
        description="Choisissez la tontine et le membre concerné."
      >
        {tontines.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Aucune tontine disponible.</p>
        ) : (
          <form
            action={async (fd) => {
              await createPenaltyAction(fd);
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
              {members.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Aucun membre inscrit
                  {selected ? ` à « ${selected.name} »` : ""}.
                </p>
              ) : (
                <Select key={periodId} name="memberId" required defaultValue="">
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div>
              <Label>Date</Label>
              <Input name="date" type="date" required />
            </div>
            <div>
              <Label>Motif</Label>
              <Select
                name="motif"
                value={motif}
                onChange={(e) =>
                  setMotif(e.target.value as (typeof MOTIF_OPTIONS)[number]["value"])
                }
              >
                {MOTIF_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Libellé</Label>
              <Input
                key={motif}
                name="motifLabel"
                defaultValue={motifLabelDefault}
                required
              />
            </div>
            <div>
              <Label>Montant (0 = montant paramètre)</Label>
              <Input name="amount" type="number" min={0} defaultValue={0} />
              <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
              >
                Annuler
              </button>
              <SubmitButton
                className="!rounded-full"
                pendingLabel="Enregistrement…"
                disabled={members.length === 0}
              >
                Enregistrer
              </SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
