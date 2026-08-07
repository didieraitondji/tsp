"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PwaRegister } from "@/components/pwa-register";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <PwaRegister />
      <NavigationProgress />
      <PwaInstallPrompt />
      {children}
    </SessionProvider>
  );
}
