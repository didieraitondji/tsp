import { ReactNode } from "react";
import { requireRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin-shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireRole(["SUPER_ADMIN"]);
  return (
    <AdminShell userName={session.user.name} userPhone={session.user.phone}>
      {children}
    </AdminShell>
  );
}
