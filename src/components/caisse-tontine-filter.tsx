"use client";

import { useRouter } from "next/navigation";

type TontineOption = { id: string; name: string };

export function CaisseTontineFilter({
  periods,
  value,
  type,
}: {
  periods: TontineOption[];
  value: string;
  type: string;
}) {
  const router = useRouter();

  const push = (tontine: string, nextType: string) => {
    const params = new URLSearchParams();
    if (tontine) params.set("tontine", tontine);
    if (nextType && nextType !== "all") params.set("type", nextType);
    router.push(`/gestion/caisse?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="whitespace-nowrap text-[var(--muted)]">Tontine</span>
        <select
          value={value}
          onChange={(e) => push(e.target.value, type)}
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
        <span className="whitespace-nowrap text-[var(--muted)]">Type</span>
        <select
          value={type || "all"}
          onChange={(e) => push(value, e.target.value)}
          className="cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm text-[var(--navy)] outline-none ring-[var(--brand)] focus:ring-2"
        >
          <option value="all">Tous</option>
          <option value="Entrée">Entrées</option>
          <option value="Sortie">Sorties</option>
        </select>
      </label>
    </div>
  );
}
