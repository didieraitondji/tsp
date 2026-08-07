"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Receipt,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/modal";
import { beginPageTransition } from "@/components/navigation-progress";

export type MembreTontineOption = {
  id: string;
  name: string;
  status: string;
};

const NAV: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/membre", label: "Vue d’ensemble", icon: LayoutDashboard, exact: true },
  { href: "/membre/cotisations", label: "Cotisations", icon: PiggyBank },
  { href: "/membre/prets", label: "Prêts", icon: Handshake },
  { href: "/membre/penalites", label: "Pénalités", icon: Receipt },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  return exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function withTontine(href: string, tontineId: string | null): string {
  if (!tontineId) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}tontine=${encodeURIComponent(tontineId)}`;
}

export function MembreShell({
  children,
  userName,
  userPhone,
  tontines,
  selectedTontineId,
}: {
  children: ReactNode;
  userName: string;
  userPhone?: string;
  tontines: MembreTontineOption[];
  selectedTontineId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const tontineId = searchParams.get("tontine");

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (tontines.length === 0) return;
    if (tontineId && tontines.some((t) => t.id === tontineId)) return;
    const preferred =
      selectedTontineId && tontines.some((t) => t.id === selectedTontineId)
        ? selectedTontineId
        : tontines.find((t) => t.status === "active")?.id ?? tontines[0].id;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tontine", preferred);
    router.replace(`${pathname}?${params.toString()}`);
  }, [tontines, tontineId, selectedTontineId, pathname, router, searchParams]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function onTontineChange(next: string) {
    beginPageTransition();
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("tontine", next);
    else params.delete("tontine");
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] text-[var(--navy)]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#152238] text-[#F4E4D7] shadow-[0_12px_40px_-20px_rgba(15,24,40,0.55)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:h-[4.25rem] md:px-6">
          <Link href={withTontine("/membre", tontineId)} className="shrink-0">
            <Image
              src="/logo.png"
              alt="Solidarité Plus"
              width={140}
              height={56}
              className="h-9 w-auto brightness-110"
              priority
            />
          </Link>

          <div className="hidden min-w-0 flex-1 items-center md:flex">
            <nav className="ml-4 flex items-center gap-1 lg:ml-8">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={withTontine(item.href, tontineId)}
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-[#FFCD79] text-[#1D2D50]"
                        : "text-[#F4E4D7]/75 hover:bg-white/5 hover:text-[#FFCD79]"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            {tontines.length > 0 && (
              <label className="hidden items-center gap-2 sm:flex">
                <span className="sr-only">Tontine</span>
                <select
                  value={tontineId || ""}
                  onChange={(e) => onTontineChange(e.target.value)}
                  className="max-w-[11rem] cursor-pointer truncate rounded-full border border-white/15 bg-white/5 py-2 pl-3 pr-8 text-xs font-semibold text-[#FFCD79] outline-none transition hover:border-[#FFCD79]/50 focus:border-[#FFCD79] md:max-w-[14rem] md:text-sm"
                >
                  {tontines.map((t) => (
                    <option key={t.id} value={t.id} className="text-[var(--navy)]">
                      {t.name}
                      {t.status === "closed" ? " (clôturée)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              type="button"
              className="inline-flex rounded-lg border border-white/15 p-2 text-[#F4E4D7] md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-4 w-4" strokeWidth={1.75} />
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-2 transition hover:border-[#FFCD79]/50"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1D2D50] text-xs font-bold text-[#FFCD79] ring-1 ring-[#FFCD79]/30">
                  {initials(userName)}
                </span>
                <span className="hidden max-w-[8rem] truncate text-left text-sm font-medium md:block">
                  {userName}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[#F4E4D7]/60 transition ${
                    menuOpen ? "rotate-180 text-[#FFCD79]" : ""
                  }`}
                  strokeWidth={2}
                />
              </button>

              {menuOpen && (
                <div
                  id={menuId}
                  role="menu"
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--line)] bg-white text-[var(--navy)] shadow-[0_16px_40px_-16px_rgba(21,34,56,0.45)]"
                >
                  <div className="border-b border-[var(--line)] px-4 py-3">
                    <p className="truncate text-sm font-semibold">{userName}</p>
                    {userPhone && (
                      <p className="mt-0.5 truncate font-mono text-xs text-[var(--muted)]">
                        {userPhone}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--sand)]">
                      Membre
                    </p>
                  </div>
                  <div className="p-1.5">
                    <Link
                      href={withTontine("/membre/profil", tontineId)}
                      role="menuitem"
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition hover:bg-[var(--cream)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      <User className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.75} />
                      Mon profil
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-700 transition hover:bg-red-50"
                      onClick={() => {
                        setMenuOpen(false);
                        setLogoutOpen(true);
                      }}
                    >
                      <LogOut className="h-4 w-4" strokeWidth={1.75} />
                      Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {tontines.length > 0 && (
          <div className="border-t border-white/10 px-4 py-2 sm:hidden">
            <select
              value={tontineId || ""}
              onChange={(e) => onTontineChange(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-[#FFCD79] outline-none"
            >
              {tontines.map((t) => (
                <option key={t.id} value={t.id} className="text-[var(--navy)]">
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fermer"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-[#152238] text-[#F4E4D7] shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <Image src="/logo.png" alt="Solidarité Plus" width={120} height={48} className="h-8 w-auto" />
              <button
                type="button"
                className="rounded-lg p-1.5 hover:bg-white/5"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="px-4 pt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FFCD79]">
              Espace membre
            </p>
            <nav className="flex flex-1 flex-col gap-1 p-3">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={withTontine(item.href, tontineId)}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-[#FFCD79] text-[#1D2D50]"
                        : "text-[#F4E4D7]/75 hover:bg-white/5 hover:text-[#FFCD79]"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">{children}</main>

      <Modal
        open={logoutOpen}
        onClose={() => !loggingOut && setLogoutOpen(false)}
        title="Se déconnecter"
        description="Vous quitterez l’espace membre."
      >
        <p className="text-sm text-[var(--muted)]">
          Confirmer la déconnexion de{" "}
          <strong className="text-[var(--navy)]">{userName}</strong> ?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => setLogoutOpen(false)}
            className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              try {
                await signOut({ redirect: false });
                window.location.assign("/login");
              } finally {
                setLoggingOut(false);
              }
            }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
          >
            {loggingOut ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
