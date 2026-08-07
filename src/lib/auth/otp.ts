import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getMongoDb, isMongoEnabled, stripMongoId } from "@/lib/db/mongo";
import { OTP_TTL_MS } from "@/lib/auth/constants";

export type OtpPurpose = "password_setup" | "login_2fa" | "email_verify";

export interface OtpRecord {
  id: string;
  userId: string;
  email: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: string;
  createdAt: string;
  consumedAt?: string | null;
}

function localOtpPath(): string {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return path.join(dir, "otps.json");
}

async function readOtps(): Promise<OtpRecord[]> {
  if (isMongoEnabled()) {
    const db = await getMongoDb();
    const docs = await db.collection("otps").find({}).toArray();
    return docs.map((d) => {
      const clean = stripMongoId(d) as OtpRecord;
      return clean;
    });
  }
  const file = localOtpPath();
  if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as { items?: OtpRecord[] } | OtpRecord[];
    return Array.isArray(data) ? data : data.items ?? [];
  } catch {
    return [];
  }
}

async function writeOtps(items: OtpRecord[]): Promise<void> {
  if (isMongoEnabled()) {
    const db = await getMongoDb();
    await db.collection("otps").deleteMany({});
    if (items.length) await db.collection("otps").insertMany(items);
    return;
  }
  const file = localOtpPath();
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ items }, null, 2), "utf8");
  renameSync(tmp, file);
}

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

export async function createOtpChallenge(input: {
  userId: string;
  email: string;
  purpose: OtpPurpose;
}): Promise<{ challengeId: string; code: string }> {
  const code = generateCode();
  const now = Date.now();
  const record: OtpRecord = {
    id: `OTP-${uuid().slice(0, 8)}`,
    userId: input.userId,
    email: input.email.trim().toLowerCase(),
    purpose: input.purpose,
    codeHash: await bcrypt.hash(code, 8),
    expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
    createdAt: new Date(now).toISOString(),
    consumedAt: null,
  };

  const items = await readOtps();
  // Invalide les anciens OTP non consommés du même user/purpose
  const pruned = items.filter(
    (o) =>
      !(o.userId === input.userId && o.purpose === input.purpose && !o.consumedAt) &&
      new Date(o.expiresAt).getTime() > now - OTP_TTL_MS
  );
  await writeOtps([...pruned, record]);
  return { challengeId: record.id, code };
}

export async function verifyOtpChallenge(input: {
  challengeId: string;
  code: string;
  userId?: string;
  purpose?: OtpPurpose;
}): Promise<{ ok: true; email: string; userId: string } | { ok: false; error: string }> {
  const items = await readOtps();
  const idx = items.findIndex((o) => o.id === input.challengeId);
  if (idx < 0) return { ok: false, error: "Code invalide ou expiré." };
  const rec = items[idx];
  if (rec.consumedAt) return { ok: false, error: "Code déjà utilisé." };
  if (new Date(rec.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "Code expiré. Demandez-en un nouveau." };
  }
  if (input.userId && rec.userId !== input.userId) {
    return { ok: false, error: "Code invalide." };
  }
  if (input.purpose && rec.purpose !== input.purpose) {
    return { ok: false, error: "Code invalide." };
  }
  const match = await bcrypt.compare(String(input.code).trim(), rec.codeHash);
  if (!match) return { ok: false, error: "Code incorrect." };

  const copy = [...items];
  copy[idx] = { ...rec, consumedAt: new Date().toISOString() };
  await writeOtps(copy);
  return { ok: true, email: rec.email, userId: rec.userId };
}
