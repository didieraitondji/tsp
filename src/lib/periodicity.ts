import type { Periodicity, Week } from "@/lib/types";

const WEEKDAY_LABELS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const;

export function formatPeriodicity(p: Periodicity | null | undefined): string {
  if (!p || typeof p !== "object" || !("type" in p)) {
    return "Périodicité non définie";
  }
  if (p.type === "weekday") {
    return `Chaque ${WEEKDAY_LABELS[p.weekday] ?? "?"}`;
  }
  if (p.type === "every_n_days") {
    return p.intervalDays === 1 ? "Tous les jours" : `Tous les ${p.intervalDays} jours`;
  }
  return "Périodicité non définie";
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** Première date ≥ start qui tombe sur le weekday demandé (0 = dimanche). */
function firstWeekdayOnOrAfter(start: Date, weekday: number): Date {
  const d = new Date(start);
  const delta = (weekday - d.getDay() + 7) % 7;
  return addDays(d, delta);
}

export function generateOccurrenceDates(
  startDate: string,
  endDate: string,
  periodicity: Periodicity
): string[] {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (end < start) return [];

  const dates: string[] = [];

  if (periodicity.type === "weekday") {
    let cur = firstWeekdayOnOrAfter(start, periodicity.weekday);
    while (cur <= end) {
      dates.push(toIsoDate(cur));
      cur = addDays(cur, 7);
    }
    return dates;
  }

  let cur = new Date(start);
  while (cur <= end) {
    dates.push(toIsoDate(cur));
    cur = addDays(cur, periodicity.intervalDays);
  }
  return dates;
}

export function generateWeeks(
  startDate: string,
  endDate: string,
  periodicity: Periodicity
): Week[] {
  return generateOccurrenceDates(startDate, endDate, periodicity).map((date, index) => {
    const d = parseIsoDate(date);
    return {
      id: `W-${date}`,
      date,
      label: `Séance ${index + 1}`,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    };
  });
}
