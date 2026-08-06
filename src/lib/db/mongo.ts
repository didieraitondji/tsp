import { MongoClient, Db, type Document } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoIndexesReady: Promise<void> | undefined;
}

export function isMongoEnabled(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}

export function getMongoDbName(): string {
  return process.env.MONGODB_DB?.trim() || "solidarite_plus";
}

export async function getMongoDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI manquant");

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 8_000,
      connectTimeoutMS: 10_000,
    });
    global._mongoClientPromise = client.connect();
  }

  const client = await global._mongoClientPromise;
  return client.db(getMongoDbName());
}

export async function ensureMongoIndexes(): Promise<void> {
  if (!global._mongoIndexesReady) {
    global._mongoIndexesReady = (async () => {
      const db = await getMongoDb();
      await Promise.all([
        db.collection("members").createIndex({ id: 1 }, { unique: true }),
        db.collection("enrollments").createIndex({ periodId: 1, id: 1 }, { unique: true }),
        db.collection("enrollments").createIndex({ periodId: 1, memberId: 1 }, { unique: true }),
        db.collection("weeks").createIndex({ periodId: 1, id: 1 }, { unique: true }),
        db.collection("contributions").createIndex({ periodId: 1, id: 1 }, { unique: true }),
        db.collection("contributions").createIndex({ periodId: 1, memberId: 1, weekId: 1 }),
        db.collection("loans").createIndex({ periodId: 1, id: 1 }, { unique: true }),
        db.collection("repayments").createIndex({ periodId: 1, id: 1 }, { unique: true }),
        db.collection("penalties").createIndex({ periodId: 1, id: 1 }, { unique: true }),
        db.collection("cashbook").createIndex({ periodId: 1, id: 1 }, { unique: true }),
        db.collection("audit").createIndex({ periodId: 1, id: 1 }, { unique: true }),
        db.collection("settings").createIndex({ periodId: 1 }, { unique: true }),
        db.collection("users").createIndex({ phone: 1 }, { unique: true }),
        db.collection("users").createIndex({ id: 1 }, { unique: true }),
        db.collection("periods").createIndex({ id: 1 }, { unique: true }),
      ]);
    })();
  }
  await global._mongoIndexesReady;
}

export function stripMongoId<T extends Document>(doc: T | null): Omit<T, "_id"> | null {
  if (!doc) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = doc;
  return rest as Omit<T, "_id">;
}
