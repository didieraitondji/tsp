import Link from "next/link";
import { ArrowRight, CalendarDays, TrendingUp } from "lucide-react";
import type {
  DashboardContributionPoint,
  DashboardSessionPoint,
} from "@/lib/db/domain";
import { formatDate, formatFcfa } from "@/lib/format";

function shortFcfa(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} k`;
  }
  return String(Math.round(n));
}

function AmountBarsChart({
  title,
  description,
  points,
  periodId,
}: {
  title: string;
  description: string;
  points: { key: string; label: string; amount: number; title?: string }[];
  periodId: string;
}) {
  const href = `/gestion/cotisations?tontine=${encodeURIComponent(periodId)}`;
  const W = 720;
  const H = 260;
  const padL = 4;
  const padR = 4;
  const padT = 28; // place pour les montants au-dessus
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxY = Math.max(1, ...points.map((p) => p.amount));
  const n = points.length;
  const gap = n > 10 ? 22 : 28;
  const slot = n > 0 ? plotW / n : plotW;
  const barW = Math.max(12, Math.min(36, slot - gap));
  const baseline = padT + plotH;

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_1px_0_rgba(29,45,80,0.04)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
            <TrendingUp
              className="h-4 w-4 text-[var(--sand)]"
              strokeWidth={1.75}
            />
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{description}</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sand)] hover:text-[var(--navy)]"
        >
          Voir le détail <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {points.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
          Aucune donnée pour tracer le graphe.
        </p>
      ) : (
        <div className="p-4 md:p-5">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ aspectRatio: `${W} / ${H}` }}
            role="img"
            aria-label={title}
          >
            {[0.25, 0.5, 0.75, 1].map((t) => {
              const y = padT + plotH * (1 - t);
              return (
                <line
                  key={t}
                  x1={padL}
                  x2={W - padR}
                  y1={y}
                  y2={y}
                  stroke="var(--line)"
                  strokeWidth={1}
                />
              );
            })}
            <line
              x1={padL}
              x2={W - padR}
              y1={baseline}
              y2={baseline}
              stroke="var(--line)"
              strokeWidth={1.25}
            />
            {points.map((p, i) => {
              const cx = padL + slot * i + slot / 2;
              const x = cx - barW / 2;
              const h =
                p.amount > 0
                  ? Math.max(4, (p.amount / maxY) * plotH)
                  : 0;
              const y = baseline - h;
              return (
                <g key={p.key}>
                  <title>
                    {p.title ?? `${p.label} · ${formatFcfa(p.amount)}`}
                  </title>
                  {p.amount > 0 && (
                    <>
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={h}
                        rx={4}
                        ry={4}
                        fill="#1D2D50"
                      />
                      <text
                        x={cx}
                        y={y - 8}
                        textAnchor="middle"
                        className="fill-[var(--navy)]"
                        style={{
                          fontSize: n > 10 ? 10 : 11,
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {shortFcfa(p.amount)}
                      </text>
                    </>
                  )}
                  <text
                    x={cx}
                    y={H - 8}
                    textAnchor="middle"
                    className="fill-[var(--muted)]"
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}

export function ContributionsEvolutionChart({
  points,
  periodId,
}: {
  points: DashboardContributionPoint[];
  periodId: string;
}) {
  const last = points[points.length - 1];
  const peak = points.reduce(
    (best, p) => (p.amount > best.amount ? p : best),
    points[0] ?? { key: "", label: "—", amount: 0, cumulative: 0 }
  );
  const description = [
    "Montant payé chaque mois",
    last ? `cumul saison ${formatFcfa(last.cumulative)}` : null,
    peak?.amount > 0 ? `pic ${peak.label}. ${formatFcfa(peak.amount)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AmountBarsChart
      title="Cotisations par mois"
      description={description}
      periodId={periodId}
      points={points.map((p) => ({
        key: p.key,
        label: p.label,
        amount: p.amount,
        title: `${p.key} · ${formatFcfa(p.amount)}`,
      }))}
    />
  );
}

function AmountLineChart({
  title,
  description,
  points,
  periodId,
}: {
  title: string;
  description: string;
  points: { key: string; label: string; amount: number; title?: string }[];
  periodId: string;
}) {
  const href = `/gestion/cotisations?tontine=${encodeURIComponent(periodId)}`;

  const W = 720;
  const H = 240;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxY = Math.max(1, ...points.map((p) => p.amount));
  const n = points.length;
  const coords = points.map((p, i) => ({
    x: padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW),
    y: padT + plotH - (p.amount / maxY) * plotH,
  }));
  const line =
    n === 0
      ? ""
      : n === 1
        ? `M ${coords[0].x} ${coords[0].y}`
        : `M ${coords.map((c) => `${c.x} ${c.y}`).join(" L ")}`;
  const baseline = padT + plotH;
  const area =
    n > 0
      ? `${line} L ${coords[n - 1].x} ${baseline} L ${coords[0].x} ${baseline} Z`
      : "";

  const labelIndexes = (() => {
    if (n <= 1) return new Set([0]);
    const maxLabels = Math.min(8, n);
    const set = new Set<number>([0, n - 1]);
    for (let k = 1; k < maxLabels - 1; k++) {
      set.add(Math.round((k * (n - 1)) / (maxLabels - 1)));
    }
    return set;
  })();

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_1px_0_rgba(29,45,80,0.04)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--navy)]">
            <CalendarDays
              className="h-4 w-4 text-[var(--sand)]"
              strokeWidth={1.75}
            />
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{description}</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sand)] hover:text-[var(--navy)]"
        >
          Voir le détail <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {points.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
          Aucune donnée pour tracer le graphe.
        </p>
      ) : (
        <div className="p-4 md:p-5">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ aspectRatio: `${W} / ${H}` }}
            role="img"
            aria-label={title}
          >
            <defs>
              <linearGradient id="sessionArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1D2D50" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#1D2D50" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75, 1].map((t) => {
              const y = padT + plotH * (1 - t);
              return (
                <line
                  key={t}
                  x1={padL}
                  x2={W - padR}
                  y1={y}
                  y2={y}
                  stroke="var(--line)"
                  strokeWidth={1}
                />
              );
            })}
            <line
              x1={padL}
              x2={W - padR}
              y1={baseline}
              y2={baseline}
              stroke="var(--line)"
              strokeWidth={1.25}
            />
            {area && <path d={area} fill="url(#sessionArea)" />}
            <path
              d={line}
              fill="none"
              stroke="#1D2D50"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {coords.map((c, i) => (
              <g key={points[i].key}>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={n > 36 ? 3 : 3.75}
                  fill={points[i].amount > 0 ? "#fff" : "#f3eee8"}
                  stroke="#1D2D50"
                  strokeWidth={1.5}
                  opacity={points[i].amount > 0 ? 1 : 0.5}
                >
                  <title>
                    {points[i].title ??
                      `${points[i].label} · ${formatFcfa(points[i].amount)}`}
                  </title>
                </circle>
                {labelIndexes.has(i) && (
                  <text
                    x={c.x}
                    y={H - 8}
                    textAnchor={
                      i === 0 ? "start" : i === n - 1 ? "end" : "middle"
                    }
                    className="fill-[var(--muted)]"
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {points[i].label}
                  </text>
                )}
              </g>
            ))}
          </svg>
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            Survolez un point pour voir la date et le montant de la séance.
          </p>
        </div>
      )}
    </section>
  );
}

export function SessionsEvolutionChart({
  points,
  periodId,
}: {
  points: DashboardSessionPoint[];
  periodId: string;
}) {
  const withAmount = points.filter((p) => p.amount > 0);
  const peak = withAmount.reduce(
    (best, p) => (p.amount > best.amount ? p : best),
    withAmount[0] ?? { key: "", label: "—", date: "", amount: 0 }
  );
  const avg =
    withAmount.length > 0
      ? Math.round(
          withAmount.reduce((s, p) => s + p.amount, 0) / withAmount.length
        )
      : 0;
  const description = [
    "Total cotisé à chaque séance",
    withAmount.length > 0 ? `${withAmount.length} séances marquées` : null,
    avg > 0 ? `moy. ${formatFcfa(avg)}` : null,
    peak.amount > 0
      ? `pic ${formatDate(peak.date)} ${formatFcfa(peak.amount)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AmountLineChart
      title="Cotisations par séance"
      description={description}
      periodId={periodId}
      points={points.map((p) => ({
        key: p.key,
        label: p.label,
        amount: p.amount,
        title: `${formatDate(p.date)} · ${formatFcfa(p.amount)}`,
      }))}
    />
  );
}
