"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { UserAccountCard } from "@/components/user-account-actions";
import type { Role, User } from "@/lib/types";

type MemberOption = { id: string; label: string };

type UserCardData = Pick<
  User,
  "id" | "name" | "phone" | "email" | "role" | "memberId" | "active" | "mustChangePassword"
> & {
  linkedMemberLabel?: string | null;
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesQuery(u: UserCardData, q: string): boolean {
  if (!q) return true;
  const hay = normalize(
    [u.name, u.phone, u.email || "", u.linkedMemberLabel || "", u.memberId || "", u.role].join(" ")
  );
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3 && u.phone.replace(/\D/g, "").includes(digits)) return true;
  return q.split(/\s+/).filter(Boolean).every((token) => hay.includes(normalize(token)));
}

export function UsersAccountsBrowser({
  users,
  members,
}: {
  users: UserCardData[];
  members: MemberOption[];
}) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const filtered = useMemo(
    () => users.filter((u) => matchesQuery(u, deferred.trim())),
    [users, deferred]
  );

  return (
    <div>
      <div className="border-b border-[var(--line)] px-5 py-3">
        <label className="relative block max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--muted)]">
            <Search className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un compte (nom, téléphone, email…)"
            className="w-full rounded-xl border border-[var(--line)] bg-white py-2.5 pl-10 pr-10 text-sm text-[var(--navy)] outline-none transition placeholder:text-[var(--muted)]/70 focus:border-[#FFCD79] focus:ring-2 focus:ring-[#FFCD79]/35"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--muted)] transition hover:text-[var(--navy)]"
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </label>
        {query.trim() && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            {filtered.length} résultat{filtered.length === 1 ? "" : "s"}
            {filtered.length !== users.length ? ` sur ${users.length}` : ""}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="px-6 py-14 text-center text-sm text-[var(--muted)]">
          {query.trim()
            ? "Aucun compte ne correspond à votre recherche."
            : "Aucun compte."}
        </p>
      ) : (
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((u) => (
            <UserAccountCard
              key={u.id}
              user={{
                id: u.id,
                name: u.name,
                phone: u.phone,
                email: u.email,
                role: u.role as Role,
                memberId: u.memberId,
                active: u.active,
                mustChangePassword: u.mustChangePassword,
              }}
              linkedMemberLabel={u.linkedMemberLabel}
              members={members}
            />
          ))}
        </div>
      )}
    </div>
  );
}
