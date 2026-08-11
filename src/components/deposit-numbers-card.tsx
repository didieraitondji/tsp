"use client";

import { useState } from "react";
import { Check, Copy, Smartphone } from "lucide-react";
import type { DepositSlot } from "@/lib/deposit";
import { formatBeninPhone } from "@/lib/phone";

export type { DepositSlot };

function CopyPhoneButton({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(phone);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--navy)] transition hover:border-[var(--sand)] hover:text-[var(--sand)]"
      aria-label="Copier le numéro"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
      {copied ? "Copié" : "Copier"}
    </button>
  );
}

export function DepositNumbersCard({ slots }: { slots: DepositSlot[] }) {
  if (slots.length === 0) return null;

  const intro =
    slots.length === 1
      ? "Déposez votre mise sur ce numéro :"
      : "Déposez votre mise sur l’un de ces numéros :";

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_1px_0_rgba(29,45,80,0.04)]">
      <div className="flex items-start gap-3 border-b border-[var(--line)] px-5 py-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF8EB] text-[var(--sand)]">
          <Smartphone className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--navy)] md:text-lg">
            Où déposer la cible
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{intro}</p>
        </div>
      </div>
      <ul className="divide-y divide-[var(--line)]">
        {slots.map((slot) => {
          const display = formatBeninPhone(slot.phone);
          return (
            <li
              key={slot.phone}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-display)] text-lg font-bold tabular-nums tracking-tight text-[var(--navy)]">
                  {display}
                </p>
                {slot.name ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Enregistré au nom de{" "}
                    <span className="font-semibold text-[var(--navy)]">
                      {slot.name}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {slots.length === 1
                      ? "Numéro de dépôt des mises"
                      : "Numéro de dépôt"}
                  </p>
                )}
              </div>
              <CopyPhoneButton phone={slot.phone} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
