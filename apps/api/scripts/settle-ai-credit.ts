import { eq } from "drizzle-orm";
import db, { getDatabasePool, schema } from "../src/database";
import { pricedMicroUsd } from "../src/billing/ai/money";
import { settleCredit } from "../src/billing/ai/wallet";

const args = process.argv.slice(2);
const id = args[args.indexOf("--reservation") + 1];
const cost = args[args.indexOf("--cost-usd") + 1];
if (
  !args.includes("--reservation") ||
  !args.includes("--cost-usd") ||
  !args.includes("--confirm") ||
  !id ||
  !cost
)
  throw new Error(
    "Usage: --reservation ID --cost-usd AUDITED_PROVIDER_COST --confirm",
  );
try {
  const [reservation] = await db
    .select()
    .from(schema.aiReservationTable)
    .where(eq(schema.aiReservationTable.id, id));
  if (!reservation) throw new Error("Reservation not found");
  await settleCredit(id, pricedMicroUsd(cost, reservation.multiplierBps));
  console.log("AI credit reservation settled");
} finally {
  await getDatabasePool().end();
}
