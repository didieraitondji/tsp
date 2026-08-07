import { redirect, RedirectType } from "next/navigation";
import { getSession, homeForRole } from "@/lib/auth/session";

export default async function LoginRedirectPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login", RedirectType.replace);
  if (session.user.mustChangePassword) {
    redirect("/auth/setup-password", RedirectType.replace);
  }
  redirect(homeForRole(session.user.role), RedirectType.replace);
}
