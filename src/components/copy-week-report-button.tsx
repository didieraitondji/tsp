"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { applyLateReportPenaltiesAction } from "@/app/actions";
import { buildWeekReportText } from "@/lib/cotisations-report";
import type { Periodicity } from "@/lib/types";

type ReportLine = { lastName: string; firstName: string; amount: number };

export function CopyWeekReportButton({
  periodId,
  weekId,
  weekDate,
  periodicity,
  lines,
  afterLate,
}: {
  periodId: string;
  weekId: string;
  weekDate: string;
  periodicity?: Periodicity | null;
  lines: ReportLine[];
  afterLate: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const label = afterLate ? "Copier (retards)" : "Copier le point";

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              if (afterLate) {
                const fd = new FormData();
                fd.set("periodId", periodId);
                fd.set("weekId", weekId);
                const result = await applyLateReportPenaltiesAction(null, fd);
                if (result?.error) {
                  setError(result.error);
                  return;
                }
              }
              const text = buildWeekReportText({
                weekDate,
                periodicity,
                afterLate,
                lines,
              });
              await copyText(text);
            } catch {
              setError("Copie impossible");
            }
          });
        }}
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-[10px] font-semibold text-[var(--navy)] transition hover:bg-[var(--cream)] disabled:cursor-wait disabled:opacity-60"
        title={
          afterLate
            ? "Copier le point après retards (crée les pénalités)"
            : "Copier le rapport de la séance"
        }
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
        ) : copied ? (
          <Check className="h-3 w-3 text-emerald-700" strokeWidth={2} />
        ) : (
          <Copy className="h-3 w-3" strokeWidth={1.75} />
        )}
        {copied ? "Copié" : label}
      </button>
      {error && <span className="max-w-[7rem] text-center text-[9px] text-red-700">{error}</span>}
    </div>
  );
}
