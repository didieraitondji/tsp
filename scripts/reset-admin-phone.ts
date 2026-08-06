/**
 * Remplace les users Mongo par le super admin téléphone.
 * Usage: npx tsx --env-file=.env.local scripts/reset-admin-phone.ts
 */
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI manquant");

  const dbName = process.env.MONGODB_DB?.trim() || "solidarite_plus";
  const phone = process.env.BOOTSTRAP_ADMIN_PHONE || "+2290140942258";
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin123!";

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const now = new Date().toISOString();

  const admin = {
    id: "USR-admin",
    phone,
    passwordHash: await bcrypt.hash(password, 10),
    name: "Super Admin",
    role: "SUPER_ADMIN",
    memberId: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.collection("users").dropIndex("email_1");
    console.log("Index email_1 supprimé");
  } catch {
    /* ignore */
  }

  const del = await db.collection("users").deleteMany({});
  console.log(`Users supprimés: ${del.deletedCount}`);

  await db.collection("users").insertOne(admin);
  try {
    await db.collection("users").createIndex({ phone: 1 }, { unique: true });
  } catch {
    /* ignore */
  }

  const check = await db
    .collection("users")
    .find({}, { projection: { phone: 1, role: 1, name: 1, _id: 0 } })
    .toArray();
  console.log("Users Mongo:", check);
  console.log(`OK → ${phone} / ${password}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
