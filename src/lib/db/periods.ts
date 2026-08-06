import type { Period, Periodicity, PeriodStatus } from "@/lib/types";
import { generateWeeks } from "@/lib/periodicity";
import {
  createEmptyPeriodBins,
  getSelectedPeriodId,
  purgePeriodData,
  readMeta,
  writeCollectionForPeriod,
  writeMeta,
} from "./store";

export async function listPeriods(): Promise<Period[]> {
  const meta = await readMeta();
  return [...meta.periods].sort(
    (a, b) => b.year - a.year || a.name.localeCompare(b.name) || b.startDate.localeCompare(a.startDate)
  );
}

export async function createPeriod(input: {
  name: string;
  startDate: string;
  endDate: string;
  periodicity: Periodicity;
  status?: PeriodStatus;
  /** Sélectionne cette tontine comme contexte de travail (n’en clôture aucune autre). */
  makeActive?: boolean;
}): Promise<Period> {
  if (input.endDate < input.startDate) {
    throw new Error("La date de fin doit être postérieure ou égale à la date de début");
  }

  const meta = await readMeta();
  const year = Number(input.startDate.slice(0, 4));
  const id = `period-${year}-${Date.now().toString(36)}`;
  const bins = await createEmptyPeriodBins(id, year, input.name);
  const period: Period = {
    id,
    name: input.name.trim(),
    year,
    startDate: input.startDate,
    endDate: input.endDate,
    periodicity: input.periodicity,
    enrollmentsOpen: true,
    status: input.status ?? "active",
    createdAt: new Date().toISOString(),
    bins,
  };

  meta.periods.push(period);
  // Plusieurs tontines peuvent rester actives en parallèle.
  // makeActive = bascule uniquement le contexte de travail sélectionné.
  if (input.makeActive !== false || !meta.activePeriodId) {
    meta.activePeriodId = period.id;
  }

  await writeMeta(meta);

  const weeks = generateWeeks(input.startDate, input.endDate, input.periodicity);
  await writeCollectionForPeriod(period, "weeks", weeks);

  return period;
}

/** Sélectionne la tontine de travail (sans clôturer les autres). */
export async function setActivePeriod(periodId: string): Promise<void> {
  const meta = await readMeta();
  if (!meta.periods.some((p) => p.id === periodId)) {
    throw new Error("Tontine introuvable");
  }
  meta.activePeriodId = periodId;
  await writeMeta(meta);
}

export async function closePeriod(periodId: string): Promise<void> {
  const meta = await readMeta();
  if (!meta.periods.some((p) => p.id === periodId)) {
    throw new Error("Tontine introuvable");
  }
  meta.periods = meta.periods.map((p) =>
    p.id === periodId ? { ...p, status: "closed" as const } : p
  );
  if (meta.activePeriodId === periodId) {
    const fallback = meta.periods.find((p) => p.id !== periodId && p.status === "active");
    meta.activePeriodId = fallback?.id ?? null;
  }
  await writeMeta(meta);
}

export async function closeEnrollments(periodId: string): Promise<void> {
  const meta = await readMeta();
  if (!meta.periods.some((p) => p.id === periodId)) {
    throw new Error("Tontine introuvable");
  }
  meta.periods = meta.periods.map((p) =>
    p.id === periodId ? { ...p, enrollmentsOpen: false } : p
  );
  await writeMeta(meta);
}

export async function reopenEnrollments(periodId: string): Promise<void> {
  const meta = await readMeta();
  if (!meta.periods.some((p) => p.id === periodId)) {
    throw new Error("Tontine introuvable");
  }
  meta.periods = meta.periods.map((p) =>
    p.id === periodId ? { ...p, enrollmentsOpen: true } : p
  );
  await writeMeta(meta);
}

/** @deprecated préférer closePeriod — ne synchronise pas activePeriodId */
export async function updatePeriodStatus(periodId: string, status: PeriodStatus): Promise<void> {
  if (status === "closed") {
    await closePeriod(periodId);
    return;
  }
  const meta = await readMeta();
  meta.periods = meta.periods.map((p) => (p.id === periodId ? { ...p, status } : p));
  await writeMeta(meta);
}

export async function deletePeriod(periodId: string): Promise<void> {
  const meta = await readMeta();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) {
    throw new Error("Tontine introuvable");
  }
  if (period.status === "active") {
    throw new Error("Impossible de supprimer une tontine encore active. Clôturez-la d’abord.");
  }

  meta.periods = meta.periods.filter((p) => p.id !== periodId);
  if (meta.activePeriodId === periodId) {
    const fallback = meta.periods.find((p) => p.status === "active");
    meta.activePeriodId = fallback?.id ?? null;
  }
  await writeMeta(meta);
  await purgePeriodData(periodId);
}

export async function assertEnrollmentsOpen(): Promise<Period> {
  const meta = await readMeta();
  const periodId = await getSelectedPeriodId();
  const period = meta.periods.find((p) => p.id === periodId);
  if (!period) {
    throw new Error("Aucune tontine sélectionnée");
  }
  if (period.status === "closed") {
    throw new Error("Cette tontine est clôturée");
  }
  if (!period.enrollmentsOpen) {
    throw new Error("Les inscriptions à cette tontine sont clôturées");
  }
  return period;
}
