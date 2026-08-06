import { getStorageDiagnostics } from "@/lib/db/store";
import { isMongoEnabled } from "@/lib/db/mongo";

export const dynamic = "force-dynamic";

export async function GET() {
  const storage = getStorageDiagnostics();
  const uri = process.env.MONGODB_URI?.trim() || "";

  return Response.json({
    mode: storage.mode,
    mongoConfigured: isMongoEnabled(),
    mongoUriPresent: Boolean(uri),
    mongoUriLooksValid: uri.startsWith("mongodb"),
    mongoDb: process.env.MONGODB_DB?.trim() || "solidarite_plus",
    hint: storage.hint,
    nextStep:
      storage.mode === "mongodb"
        ? "OK — MongoDB actif. Si les données sont vides: npm run migrate:mongo"
        : "Ajoutez MONGODB_URI dans .env.local (Atlas connection string), npm run migrate:mongo, puis relancez npm run dev.",
  });
}
