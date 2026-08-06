"use client";

import { useRouter } from "next/navigation";

type TontineOption = { id: string; name: string };

export function PretsTontineFilter({
  periods,
  value,
  status,
}: {
  periods: TontineOption[];
  value: string;
  status: string;
}) {
  const router = useRouter();

  const push = (tontine: string, nextStatus: string) => {
    const params = new URLSearchParams();
    if (tontine) params.set("tontine", tontine);
    if (nextStatus && nextStatus !== "all") params.set("statut", nextStatus);
    router.push(`/gestion/prets?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="whitespace-nowrap text-[var(--muted)]">Tontine</span>
        <select
          value={value}
          onChange={(e) => push(e.target.value, status)}
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
          value={status || "all"}
          onChange={(e) => push(value, e.target.value)}
          className="cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm text-[var(--navy)] outline-none ring-[var(--brand)] focus:ring-2"
        >
          <option value="all">Tous</option>
          <option value="En attente">En attente</option>
          <option value="En cours">En cours</option>
          <option value="En retard">En retard</option>
          <option value="Remboursé">Remboursé</option>
          <option value="Refusé">Refusé</option>
        </select>
      </label>
    </div>
  );
}
