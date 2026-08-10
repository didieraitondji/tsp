"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function MembresDirectoryFilter({
  q = "",
  du = "",
  au = "",
  inscrit = "",
}: {
  q?: string;
  du?: string;
  au?: string;
  inscrit?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(q);

  useEffect(() => {
    setQuery(q);
  }, [q]);

  const push = (next: {
    q?: string;
    du?: string;
    au?: string;
    inscrit?: string;
  }) => {
    const params = new URLSearchParams();
    params.set("view", "annuaire");
    const nextQ = (next.q ?? query).trim();
    const nextDu = next.du ?? du;
    const nextAu = next.au ?? au;
    const nextInscrit = next.inscrit ?? inscrit;
    if (nextQ) params.set("q", nextQ);
    if (nextDu) params.set("du", nextDu);
    if (nextAu) params.set("au", nextAu);
    if (nextInscrit === "oui" || nextInscrit === "non") {
      params.set("inscrit", nextInscrit);
    }
    router.push(`/gestion/membres?${params.toString()}`);
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

  const hasExtraFilters = Boolean(
    query.trim() || du || au || inscrit === "oui" || inscrit === "non"
  );

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
          placeholder="Nom, téléphone, id…"
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
        <span className="whitespace-nowrap text-[var(--muted)]">Inscription</span>
        <select
          value={inscrit || "all"}
          onChange={(e) =>
            push({
              inscrit: e.target.value === "all" ? "" : e.target.value,
            })
          }
          className="cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm text-[var(--navy)] outline-none ring-[var(--brand)] focus:ring-2"
        >
          <option value="all">Tous</option>
          <option value="oui">Inscrits</option>
          <option value="non">Non inscrits</option>
        </select>
      </label>

      {hasExtraFilters ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            push({ q: "", du: "", au: "", inscrit: "" });
          }}
          className="rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--cream)] hover:text-[var(--navy)]"
        >
          Réinitialiser
        </button>
      ) : null}
    </div>
  );
}
