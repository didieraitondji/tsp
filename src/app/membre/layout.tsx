import { Suspense, type ReactNode } from "react";
import { requireRole } from "@/lib/auth/session";
import { listMemberTontines } from "@/lib/db/domain";
import { MembreShell } from "@/components/membre-shell";

export default async function MembreLayout({ children }: { children: ReactNode }) {
  const session = await requireRole(["MEMBRE", "SUPER_ADMIN"]);
  const memberId = session.user.memberId;
  const tontines = memberId ? await listMemberTontines(memberId) : [];

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
      >
        {children}
      </MembreShell>
    </Suspense>
  );
}
