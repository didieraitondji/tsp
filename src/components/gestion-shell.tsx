"use client";

import {
  Banknote,
  Handshake,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  RotateCcw,
  Settings,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

const NAV_MAIN = [
  { href: "/gestion", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/gestion/membres", label: "Membres", icon: Users },
  { href: "/gestion/cotisations", label: "Cotisations", icon: PiggyBank },
  { href: "/gestion/prets", label: "Prêts", icon: Handshake },
  { href: "/gestion/remboursements", label: "Remboursements", icon: RotateCcw },
  { href: "/gestion/penalites", label: "Pénalités", icon: Receipt },
  { href: "/gestion/caisse", label: "Caisse", icon: Banknote },
];

const NAV_BOTTOM = {
  href: "/gestion/parametres",
  label: "Paramètres",
  icon: Settings,
};

function pageTitle(pathname: string): string {
  if (pathname === "/gestion") return "Tableau de bord";
  if (pathname.startsWith("/gestion/parametres")) return "Paramètres";
  if (pathname.startsWith("/gestion/membres")) return "Membres";
  if (pathname.startsWith("/gestion/cotisations")) return "Cotisations";
  if (pathname.startsWith("/gestion/prets")) return "Prêts";
  if (pathname.startsWith("/gestion/remboursements")) return "Remboursements";
  if (pathname.startsWith("/gestion/penalites")) return "Pénalités";
  if (pathname.startsWith("/gestion/caisse")) return "Caisse";
  if (pathname.startsWith("/gestion/profil")) return "Mon profil";
  return "Gestion";
}

export function GestionShell({
  children,
  userName,
  userPhone,
  roleLabel,
  showMembreSpace = false,
}: {
  children: ReactNode;
  userName: string;
  userPhone?: string;
  roleLabel: string;
  showMembreSpace?: boolean;
}) {
  return (
    <AppShell
      userName={userName}
      userPhone={userPhone}
      roleLabel={roleLabel}
      brandLabel="Espace gestion"
      homeHref="/gestion"
      storageKey="tsp-gestion-sidebar-collapsed"
      navMain={NAV_MAIN}
      navBottom={NAV_BOTTOM}
      profileHref="/gestion/profil"
      resolveTitle={pageTitle}
      switchSpaceHref={showMembreSpace ? "/membre" : undefined}
      switchSpaceLabel={showMembreSpace ? "Espace membre" : undefined}
    >
      {children}
    </AppShell>
  );
}
