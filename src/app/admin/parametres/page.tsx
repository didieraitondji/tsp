import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";
import { AdminSettingsForm } from "@/components/admin-settings-form";
import { settingsRepo } from "@/lib/db/collections";
import { listPeriods } from "@/lib/db/periods";
import { requireRole } from "@/lib/auth/session";

export default async function ParametresPage() {
  await requireRole(["SUPER_ADMIN"]);
  const [s, periods] = await Promise.all([settingsRepo.get(), listPeriods()]);
  const activeCount = periods.filter((p) => p.status === "active").length;

  return (
    <div className="-mx-4 px-4 md:-mx-8 md:px-[100px]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sand)]">
            Configuration
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            Paramètres
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Modèle financier Solidarité Plus
            {activeCount > 0
              ? ` · ${activeCount} tontine${activeCount > 1 ? "s" : ""} active${activeCount > 1 ? "s" : ""}`
              : ""}
            . Les gestionnaires peuvent aussi personnaliser chaque tontine dans Gestion.
          </p>
        </div>
        <Link
          href="/gestion/parametres?section=regles"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] transition hover:bg-[var(--cream)]"
        >
          <Scale className="h-4 w-4 text-[var(--sand)]" strokeWidth={1.75} />
          Règles par tontine
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </div>

      <AdminSettingsForm settings={s} />
    </div>
  );
}
