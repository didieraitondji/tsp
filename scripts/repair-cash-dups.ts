import { reconcileContributionCashEntries, computeCashBalance } from "../src/lib/db/domain";
import { readCollectionForPeriodId, readObjectForPeriodId } from "../src/lib/db/store";
import { DEFAULT_SETTINGS } from "../src/lib/db/defaults";
import type { CashEntry } from "../src/lib/types";

const periodId = process.argv[2] || "period-2026-msl0cb7u";

async function main() {
  const before = await readCollectionForPeriodId<CashEntry>(periodId, "cashbook");
  console.log("avant", before.length);

  const result = await reconcileContributionCashEntries(periodId);
  console.log("reconcile result", result);

  const after = await readCollectionForPeriodId<CashEntry>(periodId, "cashbook");
  const settings = await readObjectForPeriodId(periodId, "settings", DEFAULT_SETTINGS);
  const balance = computeCashBalance(after, settings.cashOpeningBalance);
  const totalIn = after.reduce((s, e) => s + (e.inflow || 0), 0);
  const totalOut = after.reduce((s, e) => s + (e.outflow || 0), 0);
  const cotis = after.filter((e) => e.origin === "Cotisation");
  console.log({
    apres: after.length,
    cotisations: cotis.length,
    totalIn,
    totalOut,
    balance,
    opening: settings.cashOpeningBalance,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
