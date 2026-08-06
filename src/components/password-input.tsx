"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export function PasswordInput({
  name = "password",
  required,
  minLength,
  placeholder,
  autoComplete,
  className = "",
}: {
  name?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  autoComplete?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--muted)]">
        <Lock className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <input
        id={name}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-[var(--line)] bg-white py-3 pl-11 pr-12 text-sm text-[var(--navy)] outline-none transition placeholder:text-[var(--muted)]/60 focus:border-[#FFCD79] focus:ring-2 focus:ring-[#FFCD79]/35"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center justify-center px-3.5 text-[var(--muted)] transition hover:text-[var(--navy)]"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {visible ? (
          <EyeOff className="h-5 w-5" strokeWidth={1.75} />
        ) : (
          <Eye className="h-5 w-5" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
