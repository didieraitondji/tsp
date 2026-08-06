"use client";

import { useId, useState } from "react";
import { Phone } from "lucide-react";
import {
  BENIN_LOCAL_LENGTH,
  BENIN_PREFIX,
  extractLocalPhone,
} from "@/lib/phone";

export function PhoneInput({
  name = "phone",
  required,
  defaultValue,
  id,
  className = "",
  showIcon = true,
}: {
  name?: string;
  required?: boolean;
  defaultValue?: string;
  id?: string;
  className?: string;
  showIcon?: boolean;
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const [local, setLocal] = useState(() =>
    defaultValue ? extractLocalPhone(defaultValue) : ""
  );

  const full = local.length === BENIN_LOCAL_LENGTH ? `${BENIN_PREFIX}${local}` : "";

  return (
    <div className={`relative ${className}`}>
      {showIcon && (
        <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3.5 text-[var(--muted)]">
          <Phone className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <div
        className={`flex overflow-hidden rounded-xl border border-[var(--line)] bg-white focus-within:border-[#FFCD79] focus-within:ring-2 focus-within:ring-[#FFCD79]/35 ${
          showIcon ? "pl-10" : ""
        }`}
      >
        <span className="flex shrink-0 items-center border-r border-[var(--line)] bg-[var(--panel)] px-3 text-sm font-semibold text-[var(--navy)]">
          {BENIN_PREFIX}
        </span>
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          maxLength={BENIN_LOCAL_LENGTH}
          pattern={`\\d{${BENIN_LOCAL_LENGTH}}`}
          title={`Exactement ${BENIN_LOCAL_LENGTH} chiffres après ${BENIN_PREFIX}`}
          placeholder="01XXXXXXXX"
          value={local}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, BENIN_LOCAL_LENGTH);
            setLocal(next);
          }}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-sm text-[var(--navy)] outline-none placeholder:text-[var(--muted)]/60"
        />
      </div>
      <input type="hidden" name={name} value={full} required={required} />
      {local.length > 0 && local.length < BENIN_LOCAL_LENGTH && (
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          {local.length}/{BENIN_LOCAL_LENGTH} chiffres
        </p>
      )}
    </div>
  );
}
