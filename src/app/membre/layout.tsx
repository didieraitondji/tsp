import { ReactNode } from "react";
import { requireRole } from "@/lib/auth/session";
import { Shell } from "@/components/ui";

const nav = [{ href: "/membre", label: "Ma progression" }];

export default async function MembreLayout({ children }: { children: ReactNode }) {
  const session = await requireRole(["MEMBRE", "SUPER_ADMIN"]);
  return (
    <Shell title="Espace membre" nav={nav} userName={session.user.name} roleLabel="Membre">
      {children}
    </Shell>
  );
}
