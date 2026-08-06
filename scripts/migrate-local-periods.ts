import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import type { AppMeta, User } from "../src/lib/types";
import { DEFAULT_SETTINGS } from "../src/lib/db/defaults";

/**
 * Migre l'ancienne structure plate data/*.json vers data/meta.json + data/periods/{id}/
 * et crée un compte admin si users.json est vide.
 *
 * Usage: npx tsx scripts/migrate-local-periods.ts
 */
const DATA = process.env.DATA_DIR || path.join(process.cwd(), "data");

function readJson<T>(fp: string, fallback: T): T {
  if (!existsSync(fp)) return fallback;
  const raw = readFileSync(fp, "utf-8");
  if (!raw.trim()) return fallback;
  return JSON.parse(raw) as T;
}

function writeJson(fp: string, data: unknown) {
  mkdirSync(path.dirname(fp), { recursive: true });
  writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
}

function wrapItems(data: unknown): { items: unknown[] } {
  if (Array.isArray(data)) return { items: data };
  if (data && typeof data === "object" && "items" in data) {
    return data as { items: unknown[] };
  }
  return { items: [] };
}

async function main() {
  mkdirSync(DATA, { recursive: true });
  const metaPath = path.join(DATA, "meta.json");
  const periodId = "period-2026-legacy";
  const periodDir = path.join(DATA, "periods", periodId);
  mkdirSync(periodDir, { recursive: true });

  const keys = [
    "settings",
    "enrollments",
    "weeks",
    "contributions",
    "loans",
    "repayments",
    "penalties",
    "cashbook",
    "audit",
  ] as const;

  // Ancien fichier members.json de période → enrollments + annuaire global si besoin
  const legacyMembersSrc = path.join(DATA, "members.json");
  const periodMembersDest = path.join(periodDir, "enrollments.json");
  if (!existsSync(periodMembersDest) && existsSync(legacyMembersSrc)) {
    const raw = wrapItems(readJson<unknown>(legacyMembersSrc, []));
    const legacy = raw.items as Array<Record<string, unknown>>;
    const enrollments = legacy.map((m, i) => ({
      id: `ENR-legacy-${String(i + 1).padStart(3, "0")}`,
      memberId: m.id,
      joinedAt: m.joinedAt || "2026-01-01",
      status: m.status || "Actif",
      weeklyTarget: m.weeklyTarget ?? 500,
    }));
    const globalMembers = legacy.map((m) => {
      const {
        status: _s,
        weeklyTarget: _w,
        ...identity
      } = m;
      return identity;
    });
    writeJson(periodMembersDest, { items: enrollments });
    writeJson(path.join(DATA, "members.json"), { items: globalMembers });
    renameSync(legacyMembersSrc, `${legacyMembersSrc}.period.bak`);
  }

  for (const key of keys) {
    const src = path.join(DATA, `${key}.json`);
    const dest = path.join(periodDir, `${key}.json`);
    if (existsSync(dest)) continue;
    if (key === "settings") {
      const settings = existsSync(src)
        ? readJson(src, { ...DEFAULT_SETTINGS, year: 2026 })
        : { ...DEFAULT_SETTINGS, year: 2026 };
      writeJson(dest, settings);
    } else {
      const raw = existsSync(src) ? readJson<unknown>(src, []) : [];
      writeJson(dest, wrapItems(raw));
    }
    if (existsSync(src) && key !== "enrollments") {
      renameSync(src, `${src}.bak`);
    }
  }

  if (!existsSync(path.join(DATA, "members.json"))) {
    writeJson(path.join(DATA, "members.json"), { items: [] });
  }

  // users
  let users = wrapItems(readJson<unknown>(path.join(DATA, "users.json"), [])).items as User[];
  if (users.length === 0) {
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin123!";
    const phone = process.env.BOOTSTRAP_ADMIN_PHONE || "+2290140942258";
    const now = new Date().toISOString();
    users = [
      {
        id: "USR-admin",
        phone,
        passwordHash: await bcrypt.hash(password, 10),
        name: "Super Admin",
        role: "SUPER_ADMIN",
        memberId: null,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    console.log(`Admin créé: ${phone} / ${password}`);
  }
  writeJson(path.join(DATA, "users.json"), { items: users });

  const meta: AppMeta = {
    version: 1,
    activePeriodId: periodId,
    periods: [
      {
        id: periodId,
        name: "Tontine 2026",
        year: 2026,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        periodicity: { type: "weekday", weekday: 0 },
        enrollmentsOpen: true,
        status: "active",
        createdAt: new Date().toISOString(),
        bins: {
          settings: `local:${periodId}/settings`,
          enrollments: `local:${periodId}/enrollments`,
          weeks: `local:${periodId}/weeks`,
          contributions: `local:${periodId}/contributions`,
          loans: `local:${periodId}/loans`,
          repayments: `local:${periodId}/repayments`,
          penalties: `local:${periodId}/penalties`,
          cashbook: `local:${periodId}/cashbook`,
          audit: `local:${periodId}/audit`,
        },
      },
    ],
  };
  writeJson(metaPath, meta);
  console.log("Migration locale OK →", metaPath);
  console.log("Période active:", periodId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
