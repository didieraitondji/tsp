"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const NAV = [
  { href: "#objet", label: "Engagement" },
  { href: "#cotisations", label: "Cotisations" },
  { href: "#prets", label: "Crédits" },
  { href: "#transparence", label: "Transparence" },
  { href: "#espaces", label: "Espaces" },
] as const;

export function LandingHeader({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string;
  ctaLabel: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        solid
          ? "border-b border-white/10 bg-[#152238]/90 shadow-[0_8px_32px_-12px_rgba(15,24,40,0.55)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 md:py-4">
        <Link
          href="/"
          className="relative z-10 shrink-0 transition hover:opacity-90"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/logo.png"
            alt="Solidarité Plus"
            width={150}
            height={60}
            className="h-10 w-auto md:h-11"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-[#F4E4D7]/75 transition hover:bg-white/5 hover:text-[#FFCD79]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={ctaHref}
            className="hidden rounded-full bg-[#FFCD79] px-5 py-2.5 text-sm font-semibold text-[#1D2D50] transition hover:bg-[#ffd990] sm:inline-flex"
          >
            {ctaLabel}
          </Link>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#FFCD79]/40 text-[#F4E4D7] transition hover:border-[#FFCD79] hover:bg-[#FFCD79]/10 lg:hidden"
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? "Fermer" : "Menu"}</span>
            <span className="relative block h-3.5 w-4" aria-hidden>
              <span
                className={`absolute left-0 top-0 h-0.5 w-full rounded-full bg-current transition ${
                  open ? "translate-y-1.5 rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-1.5 h-0.5 w-full rounded-full bg-current transition ${
                  open ? "opacity-0" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-3 h-0.5 w-full rounded-full bg-current transition ${
                  open ? "-translate-y-1.5 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <div
        id="landing-mobile-nav"
        className={`border-t border-white/10 bg-[#152238]/95 backdrop-blur-xl lg:hidden ${
          open ? "block" : "hidden"
        }`}
      >
        <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4" aria-label="Navigation mobile">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-3 text-sm font-medium text-[#F4E4D7]/85 transition hover:bg-white/5 hover:text-[#FFCD79]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <Link
            href={ctaHref}
            className="mt-2 inline-flex items-center justify-center rounded-full bg-[#FFCD79] px-5 py-3 text-sm font-semibold text-[#1D2D50] transition hover:bg-[#ffd990]"
            onClick={() => setOpen(false)}
          >
            {ctaLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}
