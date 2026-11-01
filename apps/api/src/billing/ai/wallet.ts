import { and, desc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { hashTrialEmail } from "../trial-identity";
import { USD } from "./money";

export type CreditDatabase =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function initializeWallet(
  workspaceId: string,
  tx: CreditDatabase,
) {
  await tx
    .insert(schema.aiWalletTable)
    .values({ workspaceId })
    .onConflictDoNothing();
  const [wallet] = await tx
    .select()
    .from(schema.aiWalletTable)
    .where(eq(schema.aiWalletTable.workspaceId, workspaceId))
    .for("update");
  if (!wallet) throw new Error("AI wallet unavailable");
  if (wallet.trialGranted) return wallet;
  const [owner] = await tx
    .select({ email: schema.userTable.email })
    .from(schema.workspaceUserTable)
    .innerJoin(
      schema.userTable,
      eq(schema.userTable.id, schema.workspaceUserTable.userId),
    )
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.role, "owner"),
        eq(schema.userTable.emailVerified, true),
      ),
    )
    .orderBy(schema.workspaceUserTable.joinedAt, schema.userTable.id)
    .limit(1);
  // An unverified owner may verify later; reads never permanently forfeit the trial.
  if (!owner) return wallet;
  const [claim] = await tx
    .insert(schema.aiTrialClaimTable)
    .values({ emailHash: hashTrialEmail(owner.email) })
    .onConflictDoNothing()
    .returning();
  const amount = claim ? USD : 0n;
  if (claim)
    await tx.insert(schema.aiLedgerTable).values({
      workspaceId,
      source: `trial:${workspaceId}`,
      kind: "trial",
      amount,
    });
  const [updated] = await tx
    .update(schema.aiWalletTable)
    .set({
      trialGranted: true,
      balance: sql`${schema.aiWalletTable.balance} + ${amount}`,
    })
    .where(eq(schema.aiWalletTable.workspaceId, workspaceId))
    .returning();
  return updated!;
}

export async function reserveCredit(input: {
  workspaceId: string;
  runId: string;
  model: string;
  amount: bigint;
  multiplierBps: number;
}) {
  return db.transaction(async (tx) => {
    const wallet = await initializeWallet(input.workspaceId, tx);
    if (input.amount <= 0n || wallet.balance - wallet.reserved < input.amount)
      throw new HTTPException(402, {
        message: "Insufficient AI balance. Add credit in workspace billing.",
      });
    const [reservation] = await tx
      .insert(schema.aiReservationTable)
      .values(input)
      .returning();
    await tx
      .update(schema.aiWalletTable)
      .set({ reserved: wallet.reserved + input.amount })
      .where(eq(schema.aiWalletTable.workspaceId, input.workspaceId));
    return reservation!;
  });
}

export async function settleCredit(id: string, amount: bigint) {
  if (amount < 0n) throw new Error("Invalid AI charge");
  await db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(schema.aiReservationTable)
      .where(eq(schema.aiReservationTable.id, id));
    if (!reservation) throw new Error("AI reservation missing");
    // All credit mutations lock the wallet first, then the source row.
    const [wallet] = await tx
      .select()
      .from(schema.aiWalletTable)
      .where(eq(schema.aiWalletTable.workspaceId, reservation.workspaceId))
      .for("update");
    const [claimed] = await tx
      .update(schema.aiReservationTable)
      .set({ status: "settled" })
      .where(
        and(
          eq(schema.aiReservationTable.id, id),
          eq(schema.aiReservationTable.status, "held"),
        ),
      )
      .returning();
    if (!claimed) return;
    await tx.insert(schema.aiLedgerTable).values({
      workspaceId: reservation.workspaceId,
      source: `usage:${id}`,
      kind: "usage",
      amount: -amount,
      runId: reservation.runId,
      model: reservation.model,
    });
    // Unexpected upstream overruns become debt, never unrecorded free usage.
    await tx
      .update(schema.aiWalletTable)
      .set({
        balance: wallet!.balance - amount,
        reserved: wallet!.reserved - reservation.amount,
      })
      .where(eq(schema.aiWalletTable.workspaceId, reservation.workspaceId));
  });
}

export async function readWallet(workspaceId: string) {
  const wallet = await db.transaction((tx) =>
    initializeWallet(workspaceId, tx),
  );
  const entries = await db
    .select({
      id: schema.aiLedgerTable.id,
      kind: schema.aiLedgerTable.kind,
      amount: schema.aiLedgerTable.amount,
      model: schema.aiLedgerTable.model,
      createdAt: schema.aiLedgerTable.createdAt,
    })
    .from(schema.aiLedgerTable)
    .where(eq(schema.aiLedgerTable.workspaceId, workspaceId))
    .orderBy(
      desc(schema.aiLedgerTable.createdAt),
      desc(schema.aiLedgerTable.id),
    )
    .limit(30);
  return {
    balanceMicroUsd: wallet.balance.toString(),
    reservedMicroUsd: wallet.reserved.toString(),
    availableMicroUsd: (wallet.balance - wallet.reserved).toString(),
    trialGranted: wallet.trialGranted,
    entries: entries.map((entry) => ({
      ...entry,
      amount: entry.amount.toString(),
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}
