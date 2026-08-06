import { redirect } from "next/navigation";

export default function PeriodesRedirectPage() {
  redirect("/gestion/parametres?section=periodes");
}
