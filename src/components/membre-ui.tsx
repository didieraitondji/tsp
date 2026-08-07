import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { formatFcfa } from "@/lib/format";

export function MembreHero({
  firstName,
  memberId,
  periodName,
  weeklyTarget,
  enrolled,
}: {
  firstName: string;
  memberId: string;
  periodName?: string | null;
  weeklyTarget?: number;
  enrolled: boolean;
}) {
  const initials =
    firstName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[#152238] px-5 py-6 text-[#F4E4D7] shadow-[0_20px_50px_-28px_rgba(21,34,56,0.55)] md:px-8 md:py-8">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#FFCD79]/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-[#D09C79]/20 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center gap-4 md:gap-5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1D2D50] text-lg font-bold text-[#FFCD79] ring-2 ring-[#FFCD79]/35 md:h-16 md:w-16 md:text-xl">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFCD79]">
            Espace membre
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight md:text-3xl">
            Bonjour {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-[#F4E4D7]/70">
            <span className="font-mono text-[#F4E4D7]/90">{memberId}</span>
            {enrolled && periodName ? (
              <>
                {" · "}
                {periodName}
                {weeklyTarget != null && weeklyTarget > 0
                  ? ` · ${formatFcfa(weeklyTarget)} / séance`
                  : null}
              </>
            ) : (
              " · pas encore inscrit à une tontine"
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export function MembreStatCard({
  label,
  value,
  icon: Icon,
  tone = "navy",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "navy" | "sand" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "amber"
        ? "bg-amber-50 text-amber-900"
        : tone === "sand"
          ? "bg-[#FFCD79]/35 text-[#1D2D50]"
          : "bg-[#1D2D50] text-[#FFCD79]";

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[0_1px_0_rgba(29,45,80,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#FFCD79] hover:shadow-[0_14px_28px_-20px_rgba(29,45,80,0.35)]">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {label}
          </p>
          <p className="mt-1 truncate font-[family-name:var(--font-display)] text-xl font-bold text-[var(--navy)] md:text-2xl">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export function MembrePanel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_1px_0_rgba(29,45,80,0.04)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-[var(--muted)]">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function MembreEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-[var(--cream)]/50 px-4 py-8 text-center text-sm text-[var(--muted)]">
      {children}
    </p>
  );
}

export function MembreAlert({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error";
}) {
  const colors =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-[#FFCD79]/50 bg-[#FFCD79]/15 text-[var(--navy)]";
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${colors}`}>
      {children}
    </div>
  );
}
