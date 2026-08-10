"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide,
  icon,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  icon?: ReactNode;
  /** Classes du corps (défaut : padding + scroll). */
  bodyClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="fixed left-1/2 top-1/2 z-50 m-0 max-h-[min(92vh,44rem)] w-[min(calc(100%-1.5rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[1.35rem] border border-[var(--line)] bg-[var(--panel)] p-0 shadow-[0_28px_80px_-24px_rgba(29,45,80,0.55)] open:flex open:animate-[modalIn_180ms_ease-out] backdrop:bg-[rgba(29,45,80,0.42)] backdrop:backdrop-blur-[3px]"
      style={wide ? { width: "min(calc(100% - 1.5rem), 36rem)" } : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="relative shrink-0 border-b border-[var(--line)] bg-gradient-to-br from-[#FFF9F3] via-[var(--panel)] to-[var(--cream)]/40 px-5 pb-4 pt-5">
        <div className="flex items-start gap-3.5">
          {icon ? (
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--navy)] text-[#FFCD79] shadow-sm">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1 pr-8">
            <h3 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[var(--navy)]">
              {title}
            </h3>
            {description ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3.5 top-3.5 rounded-xl p-1.5 text-[var(--muted)] transition hover:bg-white/80 hover:text-[var(--navy)]"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
      <div
        className={
          bodyClassName ??
          "min-h-0 flex-1 overflow-y-auto px-5 py-5"
        }
      >
        {children}
      </div>
    </dialog>
  );
}
