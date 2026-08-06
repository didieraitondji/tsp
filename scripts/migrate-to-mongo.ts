/**
 * Migre data/ locale vers MongoDB Atlas.
 *
 * Prérequis: MONGODB_URI dans .env.local
 * Usage: npm run migrate:mongo
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import type { AppMeta, Member, Period, Settings, User } from "../src/lib/types";
import { DEFAULT_SETTINGS } from "../src/lib/db/defaults";

const DATA = process.env.DATA_DIR || path.join(process.cwd(), "data");
const URI = process.env.MONGODB_URI?.trim();
const DB_NAME = process.env.MONGODB_DB?.trim() || "solidarite_plus";

function readJson<T>(fp: string, fallback: T): T {
  if (!existsSync(fp)) return fallback;
  return JSON.parse(readFileSync(fp, "utf-8")) as T;
}

function itemsOf<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && "items" in raw) {
    return (raw as { items: T[] }).items || [];
  }
  return [];
}

async function main() {
  if (!URI) throw new Error("MONGODB_URI manquant dans l'environnement");

  const metaPath = path.join(DATA, "meta.json");
  if (!existsSync(metaPath)) {
    throw new Error("data/meta.json introuvable. Créez une tontine ou lancez npm run seed");
  }

  const meta = readJson<AppMeta>(metaPath, {
    version: 1,
    activePeriodId: null,
    periods: [],
  });
  const users = itemsOf<User>(readJson(path.join(DATA, "users.json"), { items: [] }));
  const members = itemsOf<Member>(readJson(path.join(DATA, "members.json"), { items: [] }));

  console.log("Connexion MongoDB…");
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log("Index…");
  await db.collection("users").createIndex({ id: 1 }, { unique: true });
  await db.collection("users").createIndex({ phone: 1 }, { unique: true });
  await db.collection("members").createIndex({ id: 1 }, { unique: true });
  await db.collection("periods").createIndex({ id: 1 }, { unique: true });
  await db.collection("settings").createIndex({ periodId: 1 }, { unique: true });
  await db.collection("enrollments").createIndex({ periodId: 1, id: 1 }, { unique: true });
  await db.collection("enrollments").createIndex({ periodId: 1, memberId: 1 }, { unique: true });
  for (const name of [
    "weeks",
    "contributions",
    "loans",
    "repayments",
    "penalties",
    "cashbook",
    "audit",
  ]) {
    await db.collection(name).createIndex({ periodId: 1, id: 1 }, { unique: true });
  }

  console.log(`Users: ${users.length}`);
  await db.collection("users").deleteMany({});
  if (users.length) await db.collection("users").insertMany(users);

  console.log(`Members (annuaire): ${members.length}`);
  await db.collection("members").deleteMany({});
  if (members.length) await db.collection("members").insertMany(members);

  await db.collection("meta").deleteMany({});
  await db.collection("meta").insertOne({
    _id: "app",
    version: 1,
    activePeriodId: meta.activePeriodId,
  } as never);

  await db.collection("periods").deleteMany({});
  for (const period of meta.periods) {
    const { bins: _b, ...rest } = period as Period;
    await db.collection("periods").insertOne(rest);
    const dir = path.join(DATA, "periods", period.id);
    console.log("Tontine", period.id);

    const settings = readJson<Settings>(path.join(dir, "settings.json"), {
      ...DEFAULT_SETTINGS,
      year: period.year,
    });
    await db.collection("settings").deleteMany({ periodId: period.id });
    await db.collection("settings").insertOne({ ...settings, periodId: period.id });

    for (const name of [
      "enrollments",
      "weeks",
      "contributions",
      "loans",
      "repayments",
      "penalties",
      "cashbook",
      "audit",
    ] as const) {
      const list = itemsOf<Record<string, unknown>>(
        readJson(path.join(dir, `${name}.json`), { items: [] })
      );
      await db.collection(name).deleteMany({ periodId: period.id });
      if (list.length) {
        await db
          .collection(name)
          .insertMany(list.map((item) => ({ ...item, periodId: period.id })));
      }
      console.log(`  ${name}: ${list.length}`);
    }
  }

  await client.close();
  console.log("\n=== Migration MongoDB OK ===");
  console.log("DB:", DB_NAME);
  console.log("Tontines:", meta.periods.length);
  console.log("Users:", users.length);
  console.log("Members:", members.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
