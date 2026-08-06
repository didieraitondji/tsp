import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "fs";
import path from "path";
import { cache } from "react";
import { cookies } from "next/headers";
import type { AppMeta, Period, PeriodBinKey, PeriodBins, Periodicity, Settings } from "@/lib/types";
import { ensureMongoIndexes, getMongoDb, isMongoEnabled, stripMongoId } from "./mongo";
import { DEFAULT_SETTINGS } from "./defaults";

const PERIOD_COLLECTIONS: PeriodBinKey[] = [
  "settings",
  "enrollments",
  "weeks",
  "contributions",
  "loans",
  "repayments",
  "penalties",
  "cashbook",
  "audit",
];

const GLOBAL_COLLECTIONS = new Set(["users", "members"]);

const DEFAULT_PERIODICITY: Periodicity = { type: "weekday", weekday: 0 };

/** Complète les champs manquants des tontines créées avant le nouveau modèle. */
function normalizePeriod(raw: Period): Period {
  const year =
    raw.year || Number(String(raw.startDate || "").slice(0, 4)) || new Date().getFullYear();
  const startDate = raw.startDate || `${year}-01-01`;
  const endDate = raw.endDate || `${year}-12-31`;
  return {
    ...raw,
    year,
    startDate,
    endDate,
    periodicity: raw.periodicity ?? DEFAULT_PERIODICITY,
    enrollmentsOpen: raw.enrollmentsOpen !== false,
  };
}

function normalizeMeta(meta: AppMeta): AppMeta {
  return {
    ...meta,
    periods: (meta.periods || []).map((p) => normalizePeriod(p)),
  };
}

const locks = new Map<string, Promise<void>>();

export const PERIOD_COOKIE = "tsp_period";

export type StorageMode = "mongodb" | "local";

export function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

function ensureDataDir(): void {
  const dir = getDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function localMetaPath(): string {
  return path.join(getDataDir(), "meta.json");
}

function localUsersPath(): string {
  return path.join(getDataDir(), "users.json");
}

function localMembersPath(): string {
  return path.join(getDataDir(), "members.json");
}

function localPeriodFile(periodId: string, name: string): string {
  const dir = path.join(getDataDir(), "periods", periodId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return path.join(dir, `${name}.json`);
}

async function withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(
    key,
    prev.then(() => gate)
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === gate) locks.delete(key);
  }
}

function emptyMeta(): AppMeta {
  return {
    version: 1,
    activePeriodId: null,
    periods: [],
  };
}

function atomicWriteLocal(fp: string, data: unknown) {
  ensureDataDir();
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tmp, fp);
}

function readLocalJson<T>(fp: string, fallback: T): T {
  if (!existsSync(fp)) return fallback;
  const raw = readFileSync(fp, "utf-8");
  if (!raw.trim()) return fallback;
  return JSON.parse(raw) as T;
}

export function getStorageMode(): StorageMode {
  if (isMongoEnabled()) return "mongodb";
  return "local";
}

/** Diagnostic stockage (sans exposer les secrets). */
export function getStorageDiagnostics() {
  const mode = getStorageMode();
  const mongoUri = Boolean(process.env.MONGODB_URI?.trim());

  let hint = "";
  if (mode === "mongodb") {
    hint = `MongoDB Atlas actif (db: ${process.env.MONGODB_DB?.trim() || "solidarite_plus"}).`;
  } else if (mongoUri) {
    hint = "MONGODB_URI détecté mais vide après trim ? Vérifiez .env.local et relancez npm run dev.";
  } else {
    hint =
      "Mode local (fallback). Ajoutez MONGODB_URI (Atlas) dans .env.local et relancez le serveur.";
  }

  return { mode, mongoUri, hint };
}

type MetaDoc = {
  _id: "app";
  version: 1;
  activePeriodId: string | null;
};

async function readMetaMongo(): Promise<AppMeta> {
  const db = await getMongoDb();
  const meta = (await db.collection<MetaDoc>("meta").findOne({ _id: "app" })) || {
    _id: "app" as const,
    version: 1 as const,
    activePeriodId: null,
  };
  const periods = await db.collection<Period>("periods").find({}).toArray();
  return normalizeMeta({
    version: 1,
    activePeriodId: meta.activePeriodId,
    periods: periods.map((p) => stripMongoId(p)! as Period),
  });
}

async function writeMetaMongo(meta: AppMeta): Promise<void> {
  const db = await getMongoDb();
  await db.collection<MetaDoc>("meta").updateOne(
    { _id: "app" },
    {
      $set: {
        version: 1,
        activePeriodId: meta.activePeriodId,
      },
    },
    { upsert: true }
  );

  const col = db.collection("periods");
  const ids = meta.periods.map((p) => p.id);
  if (ids.length) {
    await col.deleteMany({ id: { $nin: ids } });
  } else {
    await col.deleteMany({});
  }
  for (const period of meta.periods) {
    const { bins: _b, ...rest } = period;
    await col.updateOne({ id: period.id }, { $set: rest }, { upsert: true });
  }
}

export const readMeta = cache(async (): Promise<AppMeta> => {
  if (isMongoEnabled()) return readMetaMongo();
  ensureDataDir();
  return normalizeMeta(readLocalJson(localMetaPath(), emptyMeta()));
});

export async function writeMeta(meta: AppMeta): Promise<void> {
  if (isMongoEnabled()) {
    await writeMetaMongo(meta);
    return;
  }
  atomicWriteLocal(localMetaPath(), meta);
}

export const getSelectedPeriodId = cache(async (): Promise<string | null> => {
  const meta = await readMeta();
  try {
    const jar = await cookies();
    const fromCookie = jar.get(PERIOD_COOKIE)?.value;
    if (fromCookie && meta.periods.some((p) => p.id === fromCookie)) {
      return fromCookie;
    }
  } catch {
    // hors requête HTTP
  }
  return meta.activePeriodId;
});

export const getSelectedPeriod = cache(async (): Promise<Period | null> => {
  const meta = await readMeta();
  const id = await getSelectedPeriodId();
  return meta.periods.find((p) => p.id === id) ?? null;
});

type CollectionPayload<T> = { items: T[] };

function resolveLocalPath(name: string, periodId: string | null): string {
  if (name === "users") return localUsersPath();
  if (name === "members") return localMembersPath();
  if (!periodId) {
    throw new Error("Aucune tontine active. Créez une tontine dans Gestion → Paramètres.");
  }
  return localPeriodFile(periodId, name);
}

export async function readCollection<T extends { id?: string }>(
  name: string,
  fallback: T[] = []
): Promise<T[]> {
  if (isMongoEnabled()) {
    const db = await getMongoDb();
    if (GLOBAL_COLLECTIONS.has(name)) {
      const docs = await db.collection(name).find({}).toArray();
      return docs.map((d) => stripMongoId(d) as T);
    }
    const periodId = await getSelectedPeriodId();
    if (!periodId) return fallback;
    const docs = await db.collection(name).find({ periodId }).toArray();
    return docs.map((d) => {
      const clean = stripMongoId(d) as T & { periodId?: string };
      const { periodId: _p, ...rest } = clean as T & { periodId?: string };
      return rest as T;
    });
  }

  if (!GLOBAL_COLLECTIONS.has(name) && !(await getSelectedPeriodId())) {
    return fallback;
  }

  const periodId = await getSelectedPeriodId();
  const data = readLocalJson<CollectionPayload<T> | T[]>(
    resolveLocalPath(name, periodId),
    { items: fallback }
  );
  if (Array.isArray(data)) return data;
  return data.items ?? fallback;
}

export async function writeCollection<T extends { id?: string }>(
  name: string,
  data: T[]
): Promise<void> {
  if (isMongoEnabled()) {
    const db = await getMongoDb();
    if (GLOBAL_COLLECTIONS.has(name)) {
      await db.collection(name).deleteMany({});
      if (data.length) {
        await db.collection(name).insertMany(data.map((item) => ({ ...item })));
      }
      return;
    }
    const periodId = await getSelectedPeriodId();
    if (!periodId) throw new Error("Aucune tontine active");
    await db.collection(name).deleteMany({ periodId });
    if (data.length) {
      await db.collection(name).insertMany(data.map((item) => ({ ...item, periodId })));
    }
    return;
  }

  const periodId = await getSelectedPeriodId();
  const payload: CollectionPayload<T> = { items: data };
  const lockKey = GLOBAL_COLLECTIONS.has(name) ? `global:${name}` : `${name}:${periodId}`;
  return withLock(lockKey, async () => {
    atomicWriteLocal(resolveLocalPath(name, periodId), payload);
  });
}

export async function readObject<T extends object>(name: string, fallback: T): Promise<T> {
  if (isMongoEnabled()) {
    const periodId = await getSelectedPeriodId();
    if (!periodId) return fallback;
    const db = await getMongoDb();
    const doc = await db.collection(name).findOne({ periodId });
    if (!doc) return fallback;
    const clean = stripMongoId(doc) as T & { periodId?: string };
    const { periodId: _p, ...rest } = clean as T & { periodId?: string };
    return rest as T;
  }

  const periodId = await getSelectedPeriodId();
  return readLocalJson(resolveLocalPath(name, periodId), fallback);
}

/** Lit settings (ou autre objet) pour une tontine donnée. */
export async function readObjectForPeriodId<T extends object>(
  periodId: string,
  name: string,
  fallback: T
): Promise<T> {
  if (isMongoEnabled()) {
    const db = await getMongoDb();
    const doc = await db.collection(name).findOne({ periodId });
    if (!doc) return fallback;
    const clean = stripMongoId(doc) as T & { periodId?: string };
    const { periodId: _p, ...rest } = clean as T & { periodId?: string };
    return rest as T;
  }
  return readLocalJson(resolveLocalPath(name, periodId), fallback);
}

/** Écrit settings (ou autre objet) pour une tontine donnée. */
export async function writeObjectForPeriodId<T extends object>(
  periodId: string,
  name: string,
  data: T
): Promise<void> {
  if (isMongoEnabled()) {
    const db = await getMongoDb();
    await db.collection(name).updateOne(
      { periodId },
      { $set: { ...data, periodId } },
      { upsert: true }
    );
    return;
  }

  return withLock(`${name}:${periodId}`, async () => {
    atomicWriteLocal(resolveLocalPath(name, periodId), data);
  });
}

export async function writeObject<T extends object>(name: string, data: T): Promise<void> {
  if (isMongoEnabled()) {
    const periodId = await getSelectedPeriodId();
    if (!periodId) throw new Error("Aucune tontine active");
    const db = await getMongoDb();
    await db.collection(name).updateOne(
      { periodId },
      { $set: { ...data, periodId } },
      { upsert: true }
    );
    return;
  }

  const periodId = await getSelectedPeriodId();
  return withLock(`${name}:${periodId}`, async () => {
    atomicWriteLocal(resolveLocalPath(name, periodId), data);
  });
}

export async function updateCollection<T extends { id?: string }>(
  name: string,
  updater: (items: T[]) => T[] | Promise<T[]>
): Promise<T[]> {
  const lockKey = GLOBAL_COLLECTIONS.has(name)
    ? `global:${name}`
    : isMongoEnabled()
      ? `mongo:${name}:${await getSelectedPeriodId()}`
      : `${name}:${await getSelectedPeriodId()}`;

  return withLock(lockKey, async () => {
    const current = await readCollection<T>(name);
    const next = await updater(current);
    if (isMongoEnabled()) {
      await writeCollection(name, next);
      return next;
    }
    const periodId = await getSelectedPeriodId();
    atomicWriteLocal(resolveLocalPath(name, periodId), { items: next });
    return next;
  });
}

function mongoPlaceholderBins(periodId: string): PeriodBins {
  return {
    settings: `mongo:${periodId}/settings`,
    enrollments: `mongo:${periodId}/enrollments`,
    weeks: `mongo:${periodId}/weeks`,
    contributions: `mongo:${periodId}/contributions`,
    loans: `mongo:${periodId}/loans`,
    repayments: `mongo:${periodId}/repayments`,
    penalties: `mongo:${periodId}/penalties`,
    cashbook: `mongo:${periodId}/cashbook`,
    audit: `mongo:${periodId}/audit`,
  };
}

export async function createEmptyPeriodBins(
  periodId: string,
  year: number,
  name: string
): Promise<PeriodBins> {
  const settings: Settings = { ...DEFAULT_SETTINGS, year, organizationName: "Solidarité Plus" };
  const empty = { items: [] as unknown[] };

  if (isMongoEnabled()) {
    const db = await getMongoDb();
    await ensureMongoIndexes();
    await db.collection("settings").updateOne(
      { periodId },
      { $set: { ...settings, periodId } },
      { upsert: true }
    );
    await db.collection("audit").insertOne({
      id: "AUD-period",
      periodId,
      at: new Date().toISOString(),
      actorId: "system",
      actorName: "system",
      action: "period.create",
      details: name,
    });
    return mongoPlaceholderBins(periodId);
  }

  atomicWriteLocal(localPeriodFile(periodId, "settings"), settings);
  for (const key of PERIOD_COLLECTIONS) {
    if (key === "settings") continue;
    if (key === "audit") {
      atomicWriteLocal(localPeriodFile(periodId, key), {
        items: [
          {
            id: "AUD-period",
            at: new Date().toISOString(),
            actorId: "system",
            actorName: "system",
            action: "period.create",
            details: name,
          },
        ],
      });
    } else {
      atomicWriteLocal(localPeriodFile(periodId, key), empty);
    }
  }

  return {
    settings: `local:${periodId}/settings`,
    enrollments: `local:${periodId}/enrollments`,
    weeks: `local:${periodId}/weeks`,
    contributions: `local:${periodId}/contributions`,
    loans: `local:${periodId}/loans`,
    repayments: `local:${periodId}/repayments`,
    penalties: `local:${periodId}/penalties`,
    cashbook: `local:${periodId}/cashbook`,
    audit: `local:${periodId}/audit`,
  };
}

export { PERIOD_COLLECTIONS };

/** Lit une collection pour une période donnée (sans dépendre du cookie / cache). */
export async function readCollectionForPeriodId<T extends { id?: string }>(
  periodId: string,
  name: PeriodBinKey,
  fallback: T[] = []
): Promise<T[]> {
  if (isMongoEnabled()) {
    const db = await getMongoDb();
    const docs = await db.collection(name).find({ periodId }).toArray();
    return docs.map((d) => {
      const clean = stripMongoId(d) as T & { periodId?: string };
      const { periodId: _p, ...rest } = clean as T & { periodId?: string };
      return rest as T;
    });
  }

  const data = readLocalJson<CollectionPayload<T> | T[]>(localPeriodFile(periodId, name), {
    items: fallback,
  });
  if (Array.isArray(data)) return data;
  return data.items ?? fallback;
}

/** Écrit une collection pour une période donnée (sans dépendre du cookie / cache). */
export async function writeCollectionForPeriod<T extends { id?: string }>(
  period: Period,
  name: PeriodBinKey,
  data: T[]
): Promise<void> {
  if (name === "settings") {
    throw new Error("Utilisez writeObject pour settings");
  }

  if (isMongoEnabled()) {
    const db = await getMongoDb();
    await db.collection(name).deleteMany({ periodId: period.id });
    if (data.length) {
      await db.collection(name).insertMany(data.map((item) => ({ ...item, periodId: period.id })));
    }
    return;
  }

  atomicWriteLocal(localPeriodFile(period.id, name), { items: data });
}

/** Supprime les données métier d’une période (Mongo / fichiers locaux). */
export async function purgePeriodData(periodId: string): Promise<void> {
  if (isMongoEnabled()) {
    const db = await getMongoDb();
    for (const name of PERIOD_COLLECTIONS) {
      await db.collection(name).deleteMany({ periodId });
    }
    return;
  }

  const dir = path.join(getDataDir(), "periods", periodId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}
