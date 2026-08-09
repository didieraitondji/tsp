/** Petits éléments UI partagés par les grilles cotisations. */

export function memberInitials(lastName: string, firstName: string): string {
  const a = (lastName || "").trim()[0] || "";
  const b = (firstName || "").trim()[0] || "";
  return `${a}${b}`.toUpperCase() || "?";
}

/** « A. Didier » — initiale du nom + prénoms. */
export function formatMemberShortName(lastName: string, firstName: string): string {
  const initial = (lastName || "").trim()[0]?.toUpperCase() || "";
  const prenoms = (firstName || "").trim();
  if (initial && prenoms) return `${initial}. ${prenoms}`;
  if (prenoms) return prenoms;
  return (lastName || "").trim() || "—";
}

export function MemberIdentity({
  lastName,
  firstName,
}: {
  lastName: string;
  firstName: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1D2D50] text-[10px] font-bold tracking-wide text-[#FFCD79] ring-1 ring-[#FFCD79]/25"
        aria-hidden
      >
        {memberInitials(lastName, firstName)}
      </span>
      <span className="truncate font-medium text-[var(--navy)]">
        {formatMemberShortName(lastName, firstName)}
      </span>
    </div>
  );
}

/** Ombre douce sur le bord droit des colonnes sticky. */
export const STICKY_EDGE =
  "shadow-[4px_0_14px_-10px_rgba(21,34,56,0.45)]";

export function MonthProgressBar({
  amount,
  expected,
}: {
  amount: number;
  expected: number;
}) {
  if (!(expected > 0)) return null;
  const pct = Math.min(100, Math.round((amount / expected) * 100));
  const tone =
    pct >= 100 ? "bg-emerald-600" : pct >= 50 ? "bg-[#1D2D50]" : "bg-[#c4a574]";
  return (
    <div
      className="mx-auto mt-1.5 h-1 w-full max-w-[4.5rem] overflow-hidden rounded-full bg-[#e8ddd2]"
      title={`${pct} % de la cible mois`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${tone}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function WeekColumnStats({
  paid,
  unpaid,
  total,
}: {
  paid: number;
  unpaid: number;
  total: number;
}) {
  if (total <= 0) return null;
  const marked = paid + unpaid;
  if (marked === 0) {
    return (
      <span className="mt-1 block text-[9px] font-medium tracking-wide opacity-70">
        —
      </span>
    );
  }
  return (
    <span className="mt-1 flex items-center justify-center gap-1.5 text-[9px] font-semibold tracking-wide">
      <span className="text-emerald-700/90 tabular-nums" title="Payés">
        {paid}✓
      </span>
      {unpaid > 0 && (
        <span className="text-red-700/80 tabular-nums" title="Impayés">
          {unpaid}✗
        </span>
      )}
      <span className="opacity-60 tabular-nums">
        {marked}/{total}
      </span>
    </span>
  );
}
