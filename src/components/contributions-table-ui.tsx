/** Petits éléments UI partagés par les grilles cotisations. */

export function memberInitials(lastName: string, firstName: string): string {
  const a = (lastName || "").trim()[0] || "";
  const b = (firstName || "").trim()[0] || "";
  return `${a}${b}`.toUpperCase() || "?";
}

/**
 * Dernier prénom « significatif » (> 2 lettres), pour les libellés compacts.
 * Ex. « S. Isabelle Félicité » → « Félicité », « M. Paul Jaurès » → « Jaurès ».
 */
export function pickDisplayFirstName(firstName: string): string {
  const parts = (firstName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const letterCount = (p: string) => (p.match(/\p{L}/gu) ?? []).length;
  const significant = parts.filter((p) => letterCount(p) > 2);
  if (significant.length > 0) return significant[significant.length - 1];
  return parts[parts.length - 1] ?? "";
}

/** « A. Didier » — initiale du nom + dernier prénom significatif. */
export function formatMemberShortName(lastName: string, firstName: string): string {
  const initial = (lastName || "").trim()[0]?.toUpperCase() || "";
  const prenom = pickDisplayFirstName(firstName);
  if (initial && prenom) return `${initial}. ${prenom}`;
  if (prenom) return prenom;
  return (lastName || "").trim() || "—";
}

export function MemberIdentity({
  lastName,
  firstName,
  compact = false,
}: {
  lastName: string;
  firstName: string;
  /** Avatar plus petit / espacement réduit (mobile). */
  compact?: boolean;
}) {
  const fullName = `${(lastName || "").trim()} ${(firstName || "").trim()}`.trim();
  return (
    <div
      className={`flex min-w-0 items-center ${compact ? "gap-1.5" : "gap-2.5"}`}
      title={fullName || undefined}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-[#1D2D50] font-bold tracking-wide text-[#FFCD79] ring-1 ring-[#FFCD79]/25 ${
          compact ? "h-6 w-6 text-[9px]" : "h-7 w-7 text-[10px]"
        }`}
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
