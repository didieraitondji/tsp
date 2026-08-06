import bcrypt from "bcryptjs";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { v4 as uuid } from "uuid";
import type {
  CashEntry,
  Contribution,
  Enrollment,
  Member,
  Penalty,
  Settings,
  User,
  Week,
} from "../src/lib/types";
import { DEFAULT_SETTINGS } from "../src/lib/db/defaults";
import type { AppMeta } from "../src/lib/types";

const ROOT = process.cwd();
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const EXCEL = path.join(ROOT, "docs", "BASE TONTINE SOLIDARITE PLUS 2026.xlsx");
const PERIOD_ID = "period-2026-seed";

function writeJson(fp: string, data: unknown) {
  mkdirSync(path.dirname(fp), { recursive: true });
  writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
}

function cell(sheet: XLSX.WorkSheet, r: number, c: number): unknown {
  const ref = XLSX.utils.encode_cell({ r, c });
  return sheet[ref]?.v;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function excelDateToIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) {
      const mm = String(parsed.m).padStart(2, "0");
      const dd = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${mm}-${dd}`;
    }
  }
  const s = str(v);
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s;
}

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  if (!existsSync(EXCEL)) {
    throw new Error(`Fichier Excel introuvable: ${EXCEL}`);
  }

  const wb = XLSX.readFile(EXCEL, { cellDates: true });
  const membersSheet = wb.Sheets["LES MEMBRES"];
  const identitySheet = wb.Sheets["IDENTITE"];
  const caisseSheet = wb.Sheets["CAISSE"];
  const penSheet = wb.Sheets["PENALITE"];

  // --- Members from LES MEMBRES + IDENTITE ---
  const identityByKey = new Map<
    string,
    { phone?: string; email?: string; sex?: "M" | "F" | ""; cip?: string; birthDate?: string; origin?: string; emergencyContact?: string }
  >();

  for (let r = 5; r <= 40; r++) {
    const last = str(cell(identitySheet, r, 0));
    const first = str(cell(identitySheet, r, 1));
    if (!last) continue;
    identityByKey.set(`${normalizeName(last)}|${normalizeName(first)}`, {
      phone: str(cell(identitySheet, r, 2)) || undefined,
      email: str(cell(identitySheet, r, 3)) || undefined,
      cip: str(cell(identitySheet, r, 4)) || undefined,
      birthDate: str(cell(identitySheet, r, 5)) || undefined,
      sex: (str(cell(identitySheet, r, 6)) as "M" | "F" | "") || "",
      emergencyContact: str(cell(identitySheet, r, 7)) || undefined,
      origin: str(cell(identitySheet, r, 8)) || undefined,
    });
  }

  const members: Member[] = [];
  const enrollments: Enrollment[] = [];
  for (let r = 5; r <= 40; r++) {
    const last = str(cell(membersSheet, r, 5));
    const first = str(cell(membersSheet, r, 6));
    if (!last) continue;
    const idInfo =
      identityByKey.get(`${normalizeName(last)}|${normalizeName(first)}`) ||
      [...identityByKey.entries()].find(([k]) => k.startsWith(normalizeName(last)))?.[1];

    const seq = String(members.length + 1).padStart(3, "0");
    const memberId = `TSP-2026-${seq}`;
    members.push({
      id: memberId,
      lastName: last,
      firstName: first,
      phone: idInfo?.phone,
      email: idInfo?.email,
      sex: idInfo?.sex || "",
      cip: idInfo?.cip,
      birthDate: idInfo?.birthDate,
      joinedAt: "2026-01-01",
      origin: idInfo?.origin,
      emergencyContact: idInfo?.emergencyContact,
    });
    enrollments.push({
      id: `ENR-2026-${seq}`,
      memberId,
      joinedAt: "2026-01-01",
      status: "Actif",
      weeklyTarget: 500,
    });
  }

  // Update weekly targets from first non-zero CAISSE amount
  const memberKeyToId = new Map(
    members.map((m) => [`${normalizeName(m.lastName)}|${normalizeName(m.firstName)}`, m.id])
  );

  function findMemberId(last: string, first: string): string | undefined {
    const direct = memberKeyToId.get(`${normalizeName(last)}|${normalizeName(first)}`);
    if (direct) return direct;
    const nLast = normalizeName(last).replace(/OUAND/g, "OUND").replace(/HOUND/g, "HOUND");
    const nFirst = normalizeName(first);
    for (const [k, id] of memberKeyToId) {
      const [kLast, kFirst] = k.split("|");
      if (kLast === nLast || kLast.replace(/OUAND/g, "OUND") === nLast.replace(/OUAND/g, "OUND")) {
        if (!nFirst || kFirst.includes(nFirst.split(" ")[0]) || nFirst.includes(kFirst.split(" ")[0])) {
          return id;
        }
      }
    }
    for (const [k, id] of memberKeyToId) {
      if (k.startsWith(normalizeName(last))) return id;
    }
    return undefined;
  }

  // --- Weeks from CAISSE header row 5 (0-indexed row 4), cols 2+ ---
  const weeks: Week[] = [];
  for (let c = 2; c <= 60; c++) {
    const v = cell(caisseSheet, 4, c);
    if (v == null || v === "") break;
    const iso = excelDateToIso(v);
    if (!iso || iso.length < 8) continue;
    const d = new Date(iso);
    weeks.push({
      id: `WEEK-${iso}`,
      date: iso,
      label: d.toLocaleDateString("fr-FR"),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    });
  }

  // --- Contributions ---
  const contributions: Contribution[] = [];
  for (let r = 5; r <= 40; r++) {
    const last = str(cell(caisseSheet, r, 0));
    const first = str(cell(caisseSheet, r, 1));
    if (!last || normalizeName(last).includes("TOTALE")) break;
    const memberId = findMemberId(last, first);
    if (!memberId) {
      console.warn("Membre CAISSE non résolu:", last, first);
      continue;
    }
    let firstAmount = 0;
    weeks.forEach((w, i) => {
      const amount = num(cell(caisseSheet, r, 2 + i));
      if (amount > 0) {
        if (!firstAmount) firstAmount = amount;
        contributions.push({
          id: `COT-${uuid().slice(0, 8)}`,
          memberId,
          weekId: w.id,
          amount,
          paidAt: `${w.date}T12:00:00.000Z`,
          recordedBy: "seed",
        });
      }
    });
    const enrollment = enrollments.find((e) => e.memberId === memberId);
    if (enrollment && firstAmount > 0) enrollment.weeklyTarget = firstAmount;
  }

  // --- Penalties (best effort) ---
  const penalties: Penalty[] = [];
  for (let r = 4; r <= 50; r++) {
    const last = str(cell(penSheet, r, 3));
    const first = str(cell(penSheet, r, 4));
    const amount = num(cell(penSheet, r, 6));
    if (!amount || amount <= 0) continue;
    const name = first || last;
    if (!name || normalizeName(name).includes("TOTAL")) continue;
    let memberId =
      findMemberId(last, first) ||
      [...memberKeyToId.entries()].find(([k]) => k.includes(normalizeName(name)))?.[1];
    if (!memberId) continue;
    const dateVal = cell(penSheet, r, 5);
    const date = excelDateToIso(dateVal) || "2026-01-01";
    penalties.push({
      id: `PEN-${uuid().slice(0, 8)}`,
      memberId,
      date: date.slice(0, 10),
      motif: "autre",
      motifLabel: str(dateVal).includes("absence") ? "Absence" : "Pénalité",
      amount,
      paid: str(dateVal).toLowerCase().includes("payer") || str(dateVal).toLowerCase().includes("payé"),
      paidAt: null,
      recordedBy: "seed",
      createdAt: new Date().toISOString(),
    });
  }

  // --- Cashbook from weekly totals ---
  const cashbook: CashEntry[] = [];
  let balance = 0;
  weeks.forEach((w, i) => {
    const total = contributions
      .filter((c) => c.weekId === w.id)
      .reduce((s, c) => s + c.amount, 0);
    if (total <= 0) return;
    balance += total;
    cashbook.push({
      id: `TXN-${uuid().slice(0, 8)}`,
      date: w.date,
      type: "Entrée",
      description: `Cotisations semaine ${i + 1}`,
      inflow: total,
      outflow: 0,
      balance,
      reference: "Cotisation",
      origin: "seed",
      recordedBy: "seed",
      createdAt: new Date().toISOString(),
    });
  });

  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    year: 2026,
    organizationName: "Solidarité Plus",
    cashOpeningBalance: 0,
  };

  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin123!";
  const adminPhone = process.env.BOOTSTRAP_ADMIN_PHONE || "+2290140942258";
  const now = new Date().toISOString();
  const users: User[] = [
    {
      id: "USR-admin",
      phone: adminPhone,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      name: "Super Admin",
      role: "SUPER_ADMIN",
      memberId: null,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const periodDir = path.join(DATA_DIR, "periods", PERIOD_ID);
  writeJson(path.join(periodDir, "settings.json"), settings);
  writeJson(path.join(DATA_DIR, "users.json"), { items: users });
  writeJson(path.join(DATA_DIR, "members.json"), { items: members });
  writeJson(path.join(periodDir, "enrollments.json"), { items: enrollments });
  writeJson(path.join(periodDir, "weeks.json"), { items: weeks });
  writeJson(path.join(periodDir, "contributions.json"), { items: contributions });
  writeJson(path.join(periodDir, "loans.json"), { items: [] });
  writeJson(path.join(periodDir, "repayments.json"), { items: [] });
  writeJson(path.join(periodDir, "penalties.json"), { items: penalties });
  writeJson(path.join(periodDir, "cashbook.json"), { items: cashbook });
  writeJson(path.join(periodDir, "audit.json"), {
    items: [
      {
        id: "AUD-seed",
        at: now,
        actorId: "system",
        actorName: "seed",
        action: "seed.from_excel_2026",
        details: `${members.length} membres, ${contributions.length} cotisations, ${weeks.length} semaines`,
      },
    ],
  });

  const meta: AppMeta = {
    version: 1,
    activePeriodId: PERIOD_ID,
    periods: [
      {
        id: PERIOD_ID,
        name: "Tontine 2026",
        year: 2026,
        startDate: weeks[0]?.date || "2026-01-01",
        endDate: weeks[weeks.length - 1]?.date || "2026-12-31",
        periodicity: { type: "weekday", weekday: 0 },
        enrollmentsOpen: true,
        status: "active",
        createdAt: now,
        bins: {
          settings: `local:${PERIOD_ID}/settings`,
          enrollments: `local:${PERIOD_ID}/enrollments`,
          weeks: `local:${PERIOD_ID}/weeks`,
          contributions: `local:${PERIOD_ID}/contributions`,
          loans: `local:${PERIOD_ID}/loans`,
          repayments: `local:${PERIOD_ID}/repayments`,
          penalties: `local:${PERIOD_ID}/penalties`,
          cashbook: `local:${PERIOD_ID}/cashbook`,
          audit: `local:${PERIOD_ID}/audit`,
        },
      },
    ],
  };
  writeJson(path.join(DATA_DIR, "meta.json"), meta);

  console.log("Seed terminé →", DATA_DIR);
  console.log(`Période: ${PERIOD_ID}`);
  console.log(`Membres: ${members.length}`);
  console.log(`Semaines: ${weeks.length}`);
  console.log(`Cotisations: ${contributions.length}`);
  console.log(`Pénalités: ${penalties.length}`);
  console.log(`Super admin: ${adminPhone} / ${adminPassword}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
