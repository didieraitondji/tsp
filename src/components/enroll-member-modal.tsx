"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, UsersRound } from "lucide-react";
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
  /** Inscriptions faites dans cette session (avant revalidation serveur). */
  const [sessionEnrolled, setSessionEnrolled] = useState<Record<string, string[]>>({});
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);

  const availableToEnroll = useMemo(() => {
    const tontine = tontines.find((t) => t.id === periodId);
    if (!tontine) return [];
    const enrolled = new Set([
      ...tontine.enrolledMemberIds,
      ...(sessionEnrolled[periodId] || []),
    ]);
    return directoryMembers.filter((m) => !enrolled.has(m.id));
  }, [tontines, directoryMembers, periodId, sessionEnrolled]);

  const selectedName = tontines.find((t) => t.id === periodId)?.name;

  function openModal() {
    setPeriodId(initialPeriodId);
    setSessionEnrolled({});
    setError(null);
    setLastSuccess(null);
    setFormKey((k) => k + 1);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
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
        description="La modale reste ouverte pour enchaîner plusieurs inscriptions. Fermez avec × quand vous avez terminé."
      >
        {tontines.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Aucune tontine n’accepte d’inscriptions pour le moment.
          </p>
        ) : (
          <form
            key={formKey}
            action={async (fd) => {
              setError(null);
              setLastSuccess(null);
              const result = await enrollMemberAction(fd);
              if (result?.error) {
                setError(result.error);
                return;
              }
              const enrolledId = result?.memberId || String(fd.get("memberId") || "");
              const enrolledPeriod = result?.periodId || periodId;
              if (enrolledId && enrolledPeriod) {
                setSessionEnrolled((prev) => ({
                  ...prev,
                  [enrolledPeriod]: [...(prev[enrolledPeriod] || []), enrolledId],
                }));
                const m = directoryMembers.find((d) => d.id === enrolledId);
                setLastSuccess(
                  m
                    ? `${m.lastName} ${m.firstName} inscrit${selectedName ? ` à « ${selectedName} »` : ""}.`
                    : "Membre inscrit."
                );
              }
              // Conserve la tontine, réinitialise le reste du formulaire
              setFormKey((k) => k + 1);
            }}
            className="space-y-3.5"
          >
            <div>
              <Label>Tontine</Label>
              <Select
                name="periodId"
                required
                value={periodId}
                onChange={(e) => {
                  setPeriodId(e.target.value);
                  setLastSuccess(null);
                  setError(null);
                  setFormKey((k) => k + 1);
                }}
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
                <Select name="memberId" required defaultValue="">
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

            {lastSuccess && (
              <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                {lastSuccess}
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
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)]"
              >
                Terminer
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
