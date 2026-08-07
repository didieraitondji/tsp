import { requireSession, homeForRole } from "@/lib/auth/session";
import { usersRepo } from "@/lib/db/collections";
import { SetupPasswordForm } from "@/components/setup-password-form";
import { redirect, RedirectType } from "next/navigation";

export default async function SetupPasswordPage() {
  const session = await requireSession();
  if (!session.user.mustChangePassword) {
    redirect(homeForRole(session.user.role), RedirectType.replace);
  }

  const users = await usersRepo.all();
  const user = users.find((u) => u.id === session.user.id);

  return (
    <div className="min-h-screen bg-[var(--cream)] px-4 py-10 md:py-16">
      <SetupPasswordForm initialEmail={user?.email} />
    </div>
  );
}
