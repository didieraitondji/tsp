"use client";

import { useRouter } from "next/navigation";

type TontineOption = { id: string; name: string };

export function PenalitesTontineFilter({
  periods,
  value,
  statut,
}: {
  periods: TontineOption[];
  value: string;
  statut: string;
}) {
  const router = useRouter();

  const push = (tontine: string, nextStatut: string) => {
    const params = new URLSearchParams();
    if (tontine) params.set("tontine", tontine);
    if (nextStatut && nextStatut !== "all") params.set("statut", nextStatut);
    router.push(`/gestion/penalites?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="whitespace-nowrap text-[var(--muted)]">Tontine</span>
        <select
          value={value}
          onChange={(e) => push(e.target.value, statut)}
          className="cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm text-[var(--navy)] outline-none ring-[var(--brand)] focus:ring-2"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="whitespace-nowrap text-[var(--muted)]">Statut</span>
        <select
          value={statut || "all"}
          onChange={(e) => push(value, e.target.value)}
          className="cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm text-[var(--navy)] outline-none ring-[var(--brand)] focus:ring-2"
        >
          <option value="all">Tous</option>
          <option value="impaye">Impayées</option>
          <option value="paye">Payées</option>
        </select>
      </label>
    </div>
  );
}
