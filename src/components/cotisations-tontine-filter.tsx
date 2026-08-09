"use client";

import { useRouter } from "next/navigation";

type TontineOption = { id: string; name: string };

export function CotisationsTontineFilter({
  periods,
  value,
  tab,
}: {
  periods: TontineOption[];
  value: string;
  /** Conserve l’onglet actif au changement de tontine */
  tab?: string;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="whitespace-nowrap text-[var(--muted)]">Tontine</span>
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          const params = new URLSearchParams();
          if (next) params.set("tontine", next);
          if (tab && tab !== "seances") params.set("tab", tab);
          router.push(`/gestion/cotisations?${params.toString()}`);
        }}
        className="cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm text-[var(--navy)] outline-none ring-[var(--brand)] focus:ring-2"
      >
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
