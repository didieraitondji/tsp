import { Suspense, type ReactNode } from "react";
import { canAccessGestion, requireMembreAccess } from "@/lib/auth/session";
import { listMemberTontines } from "@/lib/db/domain";
import { MembreShell } from "@/components/membre-shell";

export default async function MembreLayout({ children }: { children: ReactNode }) {
  const session = await requireMembreAccess();
  const memberId = session.user.memberId;
  const tontines = memberId ? await listMemberTontines(memberId) : [];
  const showGestionSpace = canAccessGestion(session.user.role);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] text-sm text-[var(--muted)]">
          Chargement…
        </div>
      }
    >
      <MembreShell
        userName={session.user.name}
        userPhone={session.user.phone}
        tontines={tontines.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
        }))}
        selectedTontineId={null}
        showGestionSpace={showGestionSpace}
      >
        {children}
      </MembreShell>
    </Suspense>
  );
}
