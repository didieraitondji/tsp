"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { decideLoanAction } from "@/app/actions";

export function LoanApprovalActions({
  periodId,
  loanId,
  canDecide,
  needsCip = false,
}: {
  periodId: string;
  loanId: string;
  canDecide: boolean;
  /** True si une caution est hors tontine. */
  needsCip?: boolean;
}) {
  const [pending, start] = useTransition();
  const [letterSigned, setLetterSigned] = useState(false);
  const [cipVerified, setCipVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canDecide) return null;

  const run = (decision: "approved" | "rejected") => {
    setError(null);
    if (decision === "approved") {
      if (!letterSigned) {
        setError("Cochez la lettre de demande signée.");
        return;
      }
      if (needsCip && !cipVerified) {
        setError("Cochez la vérification CIP (caution externe).");
        return;
      }
    }
    start(async () => {
      const fd = new FormData();
      fd.set("periodId", periodId);
      fd.set("loanId", loanId);
      fd.set("decision", decision);
      if (letterSigned) fd.set("letterSigned", "on");
      if (cipVerified) fd.set("cipVerified", "on");
      await decideLoanAction(fd);
    });
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1.5 rounded-lg border border-[var(--line)] bg-[#FFFBF7] px-2.5 py-2">
        <label className="flex items-start gap-2 text-[11px] text-[var(--navy)]">
          <input
            type="checkbox"
            checked={letterSigned}
            onChange={(e) => setLetterSigned(e.target.checked)}
            className="mt-0.5"
          />
          <span>Lettre de demande signée par les cautions</span>
        </label>
        {needsCip && (
          <label className="flex items-start gap-2 text-[11px] text-[var(--navy)]">
            <input
              type="checkbox"
              checked={cipVerified}
              onChange={(e) => setCipVerified(e.target.checked)}
              className="mt-0.5"
            />
            <span>Copie CIP vue (caution hors tontine)</span>
          </label>
        )}
      </div>
      {error && <p className="text-[11px] text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("approved")}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
          Approuver
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("rejected")}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
          Refuser
        </button>
      </div>
    </div>
  );
}
