"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { decideLoanAction } from "@/app/actions";

export function LoanApprovalActions({
  periodId,
  loanId,
  canDecide,
}: {
  periodId: string;
  loanId: string;
  canDecide: boolean;
}) {
  const [pending, start] = useTransition();

  if (!canDecide) return null;

  const run = (decision: "approved" | "rejected") => {
    start(async () => {
      const fd = new FormData();
      fd.set("periodId", periodId);
      fd.set("loanId", loanId);
      fd.set("decision", decision);
      await decideLoanAction(fd);
    });
  };

  return (
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
  );
}
