/**
 * Purge totale MongoDB + reset local (conserve uniquement le compte SUPER_ADMIN).
 * Usage: npx tsx --env-file=.env.local scripts/purge-all.ts
 */
import { writeFileSync, existsSync, rmSync, mkdirSync } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  const dbName = process.env.MONGODB_DB?.trim() || "solidarite_plus";
  if (!uri) throw new Error("MONGODB_URI manquant");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const cols = await db.listCollections().toArray();
  console.log("DB:", dbName);
  for (const c of cols) {
    const r = await db.collection(c.name).deleteMany({});
    console.log(`cleared ${c.name}: ${r.deletedCount}`);
  }

  const phone = process.env.BOOTSTRAP_ADMIN_PHONE || "+2290140942258";
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin123!";
  const now = new Date().toISOString();

  await db.collection("users").insertOne({
    id: "USR-admin",
    phone,
    passwordHash: await bcrypt.hash(password, 10),
    name: "Super Admin",
    role: "SUPER_ADMIN",
    memberId: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("meta").insertOne({
    _id: "app",
    version: 1,
    activePeriodId: null,
  } as never);

  const periods = await db.collection("periods").countDocuments();
  const users = await db.collection("users").countDocuments();
  const members = await db.collection("members").countDocuments();
  console.log("verify periods:", periods, "users:", users, "members:", members);

  await client.close();

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  const periodsDir = path.join(dataDir, "periods");
  if (existsSync(periodsDir)) rmSync(periodsDir, { recursive: true, force: true });

  writeFileSync(
    path.join(dataDir, "meta.json"),
    JSON.stringify(
      {
        version: 1,
        activePeriodId: null,
        periods: [],
      },
      null,
      2
    ),
    "utf-8"
  );
  writeFileSync(path.join(dataDir, "members.json"), JSON.stringify({ items: [] }, null, 2), "utf-8");

  console.log("Local meta/members reset.");
  console.log("DONE — admin conservé:", phone);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
