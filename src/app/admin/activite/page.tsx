import { auditRepo } from "@/lib/db/collections";
import { requireRole } from "@/lib/auth/session";

export default async function ActivitePage() {
  await requireRole(["SUPER_ADMIN"]);
  const audit = await auditRepo.all();
  const items = [...audit].reverse();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
          Traçabilité
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
          Journal d’activité
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Historique des actions enregistrées sur la période active.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        {items.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-[var(--muted)]">
            Aucune entrée d’audit pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {items.map((a) => (
              <li key={a.id} className="px-5 py-4 md:px-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-[var(--navy)]">{a.action}</p>
                  <time className="text-xs text-[var(--muted)]">
                    {new Date(a.at).toLocaleString("fr-FR")}
                  </time>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {a.actorName}
                  {a.details ? ` — ${a.details}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
