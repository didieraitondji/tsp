import type { Contribution, Periodicity, Week } from "@/lib/types";
import { parseIsoDate } from "@/lib/periodicity";

const WEEKDAY_LABELS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const;

export function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Ordre grille : passés (ancien→récent) | prochaine | futurs (proche→loin). */
export function orderWeeksForGrid(
  weeks: Week[],
  todayIso: string = todayIsoLocal()
): { ordered: Week[]; nextId: string | null } {
  const sorted = [...weeks].sort((a, b) => a.date.localeCompare(b.date));
  const nextIdx = sorted.findIndex((w) => w.date >= todayIso);
  if (nextIdx < 0) {
    // Tout est passé : du plus ancien au plus récent
    return { ordered: sorted, nextId: null };
  }
  const next = sorted[nextIdx];
  const pastOldestToRecent = sorted.slice(0, nextIdx);
  const futuresNearToFar = sorted.slice(nextIdx + 1);
  return { ordered: [...pastOldestToRecent, next, ...futuresNearToFar], nextId: next.id };
}

function formatLongFr(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  const raw = d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  // "02 août 2026" → "02 Août 2026"
  return raw.replace(/(\d{2}\s)([a-zàâäéèêëïîôùûüç])/, (_, a, c) => a + c.toUpperCase());
}

export function buildWeekReportTitle(
  weekDate: string,
  periodicity: Periodicity | null | undefined,
  afterLate: boolean
): string {
  const long = formatLongFr(weekDate);
  if (afterLate) {
    return `Point après paiement des retards — ${long}`;
  }
  if (periodicity?.type === "weekday") {
    const day = WEEKDAY_LABELS[periodicity.weekday] ?? "jour";
    return `Point de ce ${day} ${long}`;
  }
  return `Point du ${long}`;
}

export function buildWeekReportText(input: {
  weekDate: string;
  periodicity?: Periodicity | null;
  afterLate: boolean;
  lines: { lastName: string; firstName: string; amount: number }[];
}): string {
  const title = buildWeekReportTitle(input.weekDate, input.periodicity, input.afterLate);
  const body = input.lines
    .map((m, i) => {
      const name = `${m.lastName} ${m.firstName}`.trim();
      const amount = m.amount > 0 ? `${m.amount}f` : "NP";
      return `${i + 1}- ${name}: ${amount}`;
    })
    .join("\n");
  const total = input.lines.reduce((s, m) => s + (m.amount > 0 ? m.amount : 0), 0);
  return `${title}\n\n${body}\n\n\nTotal : ${total}f`;
}

export function contributionAmount(
  map: Map<string, Contribution>,
  memberId: string,
  weekId: string
): number {
  return map.get(`${memberId}:${weekId}`)?.amount ?? 0;
}
