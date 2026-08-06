"use client";

import {
  Activity,
  ExternalLink,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

const NAV_MAIN = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/admin/utilisateurs", label: "Comptes & rôles", icon: Users },
  { href: "/admin/activite", label: "Activité", icon: Activity },
];

const NAV_BOTTOM = {
  href: "/admin/parametres",
  label: "Paramètres",
  icon: Settings,
};

function pageTitle(pathname: string): string {
  if (pathname === "/admin") return "Tableau de bord";
  if (pathname.startsWith("/admin/utilisateurs")) return "Comptes & rôles";
  if (pathname.startsWith("/admin/parametres")) return "Paramètres";
  if (pathname.startsWith("/admin/activite")) return "Activité";
  if (pathname.startsWith("/admin/profil")) return "Mon profil";
  return "Administration";
}

export function AdminShell({
  children,
  userName,
  userPhone,
}: {
  children: ReactNode;
  userName: string;
  userPhone?: string;
}) {
  return (
    <AppShell
      userName={userName}
      userPhone={userPhone}
      roleLabel="Super admin"
      brandLabel="Super administration"
      homeHref="/admin"
      storageKey="tsp-admin-sidebar-collapsed"
      navMain={NAV_MAIN}
      navBottom={NAV_BOTTOM}
      profileHref="/admin/profil"
      resolveTitle={pageTitle}
      headerExtra={
        <a
          href="/gestion"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:border-[#FFCD79] hover:bg-[#FFF8EB] md:px-3.5 md:text-sm"
        >
          <span className="hidden sm:inline">Espace gestion</span>
          <span className="sm:hidden">Gestion</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--sand)]" strokeWidth={2} />
        </a>
      }
    >
      {children}
    </AppShell>
  );
}
