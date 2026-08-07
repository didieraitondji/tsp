"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/modal";

export type AppShellNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

function isNavActive(
  pathname: string,
  item: { href: string; exact?: boolean }
): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: AppShellNavItem;
  pathname: string;
  collapsed?: boolean;
}) {
  const active = isNavActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`flex items-center rounded-xl text-sm font-medium transition ${
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
      } ${
        active
          ? "bg-[#FFCD79] text-[#1D2D50]"
          : "text-[#F4E4D7]/75 hover:bg-white/5 hover:text-[#FFCD79]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function AppShell({
  children,
  userName,
  userPhone,
  roleLabel,
  brandLabel,
  homeHref,
  storageKey,
  navMain,
  navBottom,
  profileHref,
  resolveTitle,
  headerExtra,
}: {
  children: ReactNode;
  userName: string;
  userPhone?: string;
  roleLabel: string;
  brandLabel: string;
  homeHref: string;
  storageKey: string;
  navMain: AppShellNavItem[];
  navBottom?: AppShellNavItem;
  profileHref: string;
  resolveTitle: (pathname: string) => string;
  headerExtra?: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, storageKey]);

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

  function toggleCollapsed() {
    setCollapsed((v) => !v);
  }

  const title = resolveTitle(pathname);

  return (
    <div className="flex min-h-screen bg-[var(--cream)] text-[var(--navy)]">
      <aside
        className={`sticky top-0 z-30 hidden h-screen shrink-0 flex-col bg-[#152238] text-[#F4E4D7] transition-[width] duration-300 ease-out md:flex ${
          collapsed ? "w-[4.5rem]" : "w-64"
        }`}
      >
        <div
          className={`flex items-center border-b border-white/10 ${
            collapsed ? "justify-center px-2 py-4" : "justify-between gap-2 px-4 py-4"
          }`}
        >
          <Link href={homeHref} className="min-w-0" title="Solidarité Plus">
            {collapsed ? (
              <Image
                src="/favicon.png"
                alt="Solidarité Plus"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
            ) : (
              <Image
                src="/logo.png"
                alt="Solidarité Plus"
                width={140}
                height={56}
                className="h-9 w-auto"
              />
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="rounded-lg p-1.5 text-[#F4E4D7]/70 transition hover:bg-white/5 hover:text-[#FFCD79]"
              aria-label="Réduire le menu"
              title="Réduire"
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {!collapsed && (
          <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FFCD79]">
            {brandLabel}
          </p>
        )}

        <nav
          className="flex flex-1 flex-col gap-1 overflow-y-auto p-2.5"
          aria-label={brandLabel}
        >
          {collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="mb-1 flex items-center justify-center rounded-xl px-3 py-2.5 text-[#F4E4D7]/70 transition hover:bg-white/5 hover:text-[#FFCD79]"
              aria-label="Agrandir le menu"
              title="Agrandir"
            >
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
          {navMain.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
          ))}
        </nav>

        {navBottom && (
          <div className="mt-auto shrink-0 border-t border-white/10 p-2.5 pb-4">
            <NavLink item={navBottom} pathname={pathname} collapsed={collapsed} />
          </div>
        )}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-[#152238] text-[#F4E4D7] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <Image
                src="/logo.png"
                alt="Solidarité Plus"
                width={130}
                height={52}
                className="h-9 w-auto"
              />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 hover:bg-white/5"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FFCD79]">
              {brandLabel}
            </p>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {navMain.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </nav>
            {navBottom && (
              <div className="mt-auto shrink-0 border-t border-white/10 p-3 pb-5">
                <NavLink item={navBottom} pathname={pathname} />
              </div>
            )}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 md:h-16 md:px-6">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <button
                type="button"
                className="inline-flex rounded-lg border border-[var(--line)] p-2 text-[var(--navy)] md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="hidden rounded-lg border border-[var(--line)] p-2 text-[var(--muted)] transition hover:text-[var(--navy)] md:inline-flex"
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Agrandir la sidebar" : "Réduire la sidebar"}
                title={collapsed ? "Agrandir" : "Réduire"}
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--navy)] md:text-base">
                  {title}
                </p>
                <p className="hidden text-xs text-[var(--muted)] sm:block">Solidarité Plus</p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {headerExtra}
              <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white py-1 pl-1 pr-2 transition hover:border-[#FFCD79] md:pr-2.5"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1D2D50] text-xs font-bold text-[#FFCD79]">
                  {initials(userName)}
                </span>
                <span className="hidden max-w-[9rem] truncate text-left text-sm font-medium md:block">
                  {userName}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[var(--muted)] transition duration-200 ${
                    menuOpen ? "rotate-180 text-[var(--navy)]" : ""
                  }`}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>

              {menuOpen && (
                <div
                  id={menuId}
                  role="menu"
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-[0_16px_40px_-16px_rgba(21,34,56,0.35)]"
                >
                  <div className="border-b border-[var(--line)] px-4 py-3">
                    <p className="truncate text-sm font-semibold text-[var(--navy)]">{userName}</p>
                    {userPhone && (
                      <p className="mt-0.5 truncate font-mono text-xs text-[var(--muted)]">
                        {userPhone}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--sand)]">
                      {roleLabel}
                    </p>
                  </div>
                  <div className="p-1.5">
                    <Link
                      href={profileHref}
                      role="menuitem"
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--navy)] transition hover:bg-[var(--cream)]"
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
        </header>

        <main className="flex-1 px-4 py-8 md:px-8 md:py-10">{children}</main>
      </div>

      <Modal
        open={logoutOpen}
        onClose={() => !loggingOut && setLogoutOpen(false)}
        title="Se déconnecter"
        description="Vous quitterez votre session en cours."
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
