"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

type TontineOption = { id: string; name: string };

export function PretsTontineFilter({
  periods,
  value,
  status,
  q = "",
  du = "",
  au = "",
}: {
  periods: TontineOption[];
  value: string;
  status: string;
  q?: string;
  du?: string;
  au?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(q);

  useEffect(() => {
    setQuery(q);
  }, [q]);

  const push = (next: {
    tontine?: string;
    status?: string;
    q?: string;
    du?: string;
    au?: string;
  }) => {
    const params = new URLSearchParams();
    const tontine = next.tontine ?? value;
    const nextStatus = next.status ?? status;
    const nextQ = (next.q ?? query).trim();
    const nextDu = next.du ?? du;
    const nextAu = next.au ?? au;
    if (tontine) params.set("tontine", tontine);
    if (nextStatus && nextStatus !== "all") params.set("statut", nextStatus);
    if (nextQ) params.set("q", nextQ);
    if (nextDu) params.set("du", nextDu);
    if (nextAu) params.set("au", nextAu);
    router.push(`/gestion/prets?${params.toString()}`);
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === (q || "").trim()) return;
    const t = window.setTimeout(() => {
      push({ q: trimmed });
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on query only
  }, [query]);

  const hasExtraFilters = Boolean(query.trim() || du || au);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="relative block min-w-[12rem] flex-1 sm:max-w-[16rem]">
        <span className="sr-only">Rechercher</span>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]"
          strokeWidth={1.75}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nom ou id prêt…"
          className="w-full rounded-lg border border-[var(--line)] bg-white py-1.5 pl-8 pr-8 text-sm text-[var(--navy)] outline-none ring-[var(--brand)] placeholder:text-[var(--muted)] focus:ring-2"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              push({ q: "" });
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--muted)] transition hover:bg-[var(--cream)] hover:text-[var(--navy)]"
            aria-label="Effacer la recherche"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </label>

      <label className="flex items-center gap-2 text-sm">
        <span className="whitespace-nowrap text-[var(--muted)]">Du</span>
        <input
          type="date"
          value={du}
          onChange={(e) => push({ du: e.target.value })}
          className="cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm text-[var(--navy)] outline-none ring-[var(--brand)] focus:ring-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <span className="whitespace-nowrap text-[var(--muted)]">Au</span>
        <input
          type="date"
          value={au}
          min={du || undefined}
          onChange={(e) => push({ au: e.target.value })}
          className="cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm text-[var(--navy)] outline-none ring-[var(--brand)] focus:ring-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <span className="whitespace-nowrap text-[var(--muted)]">Tontine</span>
        <select
          value={value}
          onChange={(e) => push({ tontine: e.target.value })}
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
          onChange={(e) => push({ status: e.target.value })}
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

      {hasExtraFilters ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            push({ q: "", du: "", au: "" });
          }}
          className="rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--cream)] hover:text-[var(--navy)]"
        >
          Réinitialiser
        </button>
      ) : null}
    </div>
  );
}
