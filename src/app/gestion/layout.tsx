import { ReactNode } from "react";
import { requireGestionAccess, canWriteGestion } from "@/lib/auth/session";
import { roleLabel } from "@/lib/auth/permissions";
import { GestionShell } from "@/components/gestion-shell";

export default async function GestionLayout({ children }: { children: ReactNode }) {
  const session = await requireGestionAccess();
  const canWrite = canWriteGestion(session.user.role);
  const label = roleLabel(session.user.role);

  return (
    <GestionShell
      userName={session.user.name}
      userPhone={session.user.phone}
      roleLabel={canWrite ? label : `${label} · lecture`}
    >
      {!canWrite && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Compte en <strong>lecture seule</strong> : consultation et confirmation des prêts
          uniquement. Aucune modification des données.
        </div>
      )}
      {children}
    </GestionShell>
  );
}
