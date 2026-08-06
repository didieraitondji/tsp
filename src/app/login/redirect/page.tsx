import { redirect } from "next/navigation";
import { getSession, homeForRole } from "@/lib/auth/session";

export default async function LoginRedirectPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  redirect(homeForRole(session.user.role));
}
